import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import {
  CreatePersonDto,
  UpdatePersonDto,
  CreateResidencyDto,
  UpdateResidencyDto,
} from './dto';
import { normalizeProvinceStateForCountry } from '@storyos/types';

@Injectable()
export class PersonsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(search?: string) {
    return this.prisma.person.findMany({
      where: {
        ...this.tenantFilter(),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findById(id: string) {
    const person = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id }),
      include: {
        participations: {
          where: this.softDeleteFilter,
          include: {
            project: { select: { id: true, title: true, stage: true } },
            roles: {
              where: this.softDeleteFilter,
              include: { roleType: true },
            },
          },
        },
        residencyStatuses: {
          where: { deletedAt: null },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  async create(dto: CreatePersonDto) {
    return this.prisma.person.create({
      data: this.tenantData({
        ...dto,
        createdById: this.tenant.userId,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      }),
    });
  }

  async update(id: string, dto: UpdatePersonDto) {
    const existing = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id }),
    });
    if (!existing) throw new NotFoundException('Person not found');

    const { dateOfBirth, ...rest } = dto;
    const data: Record<string, unknown> = {
      ...rest,
      ...(dateOfBirth !== undefined
        ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
        : {}),
    };

    const auditEntries = this.buildAuditEntries(
      existing as unknown as Record<string, unknown>,
      dto as unknown as Record<string, unknown>,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.person.update({ where: { id }, data });

      if (auditEntries.length > 0) {
        await tx.personAuditLog.createMany({ data: auditEntries.map((e) => ({
          personId: id,
          organizationId: this.organizationId,
          changedById: this.tenant.userId ?? null,
          fieldName: e.fieldName,
          oldValue: e.oldValue,
          newValue: e.newValue,
        }))});

        await this.markRelatedSubmissionsStale(tx, id);
      }

      return result;
    });

    return updated;
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.person.delete({ where: { id } });
  }

  // ── Residency ───────────────────────────────────────────────────────

  async listResidency(personId: string) {
    await this.assertExists(personId);
    return this.prisma.participantResidencyStatus.findMany({
      where: { personId, organizationId: this.organizationId, deletedAt: null },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async addResidency(personId: string, dto: CreateResidencyDto) {
    await this.assertExists(personId);

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }

    await this.guardOverlap(personId, effectiveFrom, effectiveTo);

    const np = normalizeProvinceStateForCountry(dto.country, dto.provinceState);
    if (!np.ok) throw new BadRequestException(np.message);

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.participantResidencyStatus.create({
        data: {
          person: { connect: { id: personId } },
          organizationId: this.organizationId,
          createdById: this.tenant.userId ?? null,
          residencyType: dto.residencyType as any,
          country: dto.country,
          provinceState: np.value,
          effectiveFrom,
          effectiveTo,
          notes: dto.notes ?? null,
        },
      });

      await tx.personAuditLog.create({
        data: {
          personId,
          organizationId: this.organizationId,
          changedById: this.tenant.userId ?? null,
          fieldName: 'residencyStatus',
          oldValue: null,
          newValue: JSON.stringify({
            id: created.id,
            residencyType: dto.residencyType,
            country: dto.country,
            provinceState: np.value,
            effectiveFrom: dto.effectiveFrom,
            effectiveTo: dto.effectiveTo,
          }),
        },
      });

      await this.markRelatedSubmissionsStale(tx, personId);

      return created;
    });

    return record;
  }

  async updateResidency(personId: string, residencyId: string, dto: UpdateResidencyDto) {
    await this.assertExists(personId);

    const existing = await this.prisma.participantResidencyStatus.findFirst({
      where: { id: residencyId, personId, organizationId: this.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Residency record not found');

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const effectiveTo = dto.effectiveTo !== undefined
      ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null)
      : existing.effectiveTo;

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('effectiveTo must be after effectiveFrom');
    }

    await this.guardOverlap(personId, effectiveFrom, effectiveTo, residencyId);

    const mergedCountry = dto.country ?? existing.country;
    const mergedProvince =
      dto.provinceState !== undefined ? dto.provinceState : existing.provinceState;
    const mergedNorm = normalizeProvinceStateForCountry(mergedCountry, mergedProvince ?? undefined);
    if (!mergedNorm.ok) throw new BadRequestException(mergedNorm.message);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.participantResidencyStatus.update({
        where: { id: residencyId },
        data: {
          ...(dto.residencyType !== undefined ? { residencyType: dto.residencyType as any } : {}),
          ...(dto.country !== undefined ? { country: dto.country } : {}),
          ...(dto.provinceState !== undefined ? { provinceState: mergedNorm.value } : {}),
          ...(dto.effectiveFrom !== undefined ? { effectiveFrom } : {}),
          ...(dto.effectiveTo !== undefined ? { effectiveTo } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });

      const changes: Array<{ field: string; old: string | null; val: string | null }> = [];
      if (dto.residencyType !== undefined && dto.residencyType !== existing.residencyType) {
        changes.push({ field: 'residencyStatus.residencyType', old: existing.residencyType, val: dto.residencyType });
      }
      if (dto.country !== undefined && dto.country !== existing.country) {
        changes.push({ field: 'residencyStatus.country', old: existing.country, val: dto.country });
      }
      if (dto.provinceState !== undefined && dto.provinceState !== existing.provinceState) {
        changes.push({ field: 'residencyStatus.provinceState', old: existing.provinceState ?? null, val: dto.provinceState ?? null });
      }
      if (dto.effectiveFrom !== undefined && effectiveFrom.toISOString() !== existing.effectiveFrom.toISOString()) {
        changes.push({ field: 'residencyStatus.effectiveFrom', old: existing.effectiveFrom.toISOString(), val: effectiveFrom.toISOString() });
      }
      if (dto.effectiveTo !== undefined) {
        const oldTo = existing.effectiveTo?.toISOString() ?? null;
        const newTo = effectiveTo?.toISOString() ?? null;
        if (oldTo !== newTo) {
          changes.push({ field: 'residencyStatus.effectiveTo', old: oldTo, val: newTo });
        }
      }

      if (changes.length > 0) {
        await tx.personAuditLog.createMany({
          data: changes.map((c) => ({
            personId,
            organizationId: this.organizationId,
            changedById: this.tenant.userId ?? null,
            fieldName: c.field,
            oldValue: c.old,
            newValue: c.val,
          })),
        });

        await this.markRelatedSubmissionsStale(tx, personId);
      }

      return result;
    });

    return updated;
  }

  async deleteResidency(personId: string, residencyId: string) {
    await this.assertExists(personId);

    const existing = await this.prisma.participantResidencyStatus.findFirst({
      where: { id: residencyId, personId, organizationId: this.organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Residency record not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.participantResidencyStatus.delete({ where: { id: residencyId } });

      await tx.personAuditLog.create({
        data: {
          personId,
          organizationId: this.organizationId,
          changedById: this.tenant.userId ?? null,
          fieldName: 'residencyStatus.deleted',
          oldValue: JSON.stringify({
            id: existing.id,
            residencyType: existing.residencyType,
            country: existing.country,
            provinceState: existing.provinceState,
            effectiveFrom: existing.effectiveFrom.toISOString(),
            effectiveTo: existing.effectiveTo?.toISOString() ?? null,
          }),
          newValue: null,
        },
      });

      await this.markRelatedSubmissionsStale(tx, personId);
    });
  }

  // ── Audit log read ──────────────────────────────────────────────────

  async getAuditLog(personId: string) {
    await this.assertExists(personId);
    return this.prisma.personAuditLog.findMany({
      where: { personId, organizationId: this.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async assertExists(id: string) {
    const person = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id }),
      select: { id: true },
    });
    if (!person) throw new NotFoundException('Person not found');
  }

  private buildAuditEntries(
    existing: Record<string, unknown>,
    dto: Record<string, unknown>,
  ): Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> {
    const tracked = ['firstName', 'lastName', 'citizenship', 'email', 'phone',
      'dateOfBirth', 'city', 'provinceState', 'country', 'streetLine1',
      'streetLine2', 'postalCode', 'notes'];
    const entries: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];

    for (const field of tracked) {
      if (dto[field] === undefined) continue;
      const oldVal = existing[field];
      const newVal = dto[field];
      const oldStr = oldVal instanceof Date ? oldVal.toISOString() : (oldVal != null ? String(oldVal) : null);
      const newStr = newVal != null ? String(newVal) : null;
      if (oldStr !== newStr) {
        entries.push({ fieldName: field, oldValue: oldStr, newValue: newStr });
      }
    }

    return entries;
  }

  /**
   * Mark DRAFT/IN_REVIEW submissions as stale when a person's data changes.
   * Finds submissions through: Person → ProjectParticipant → Project → ProjectProgram → ProgramSubmission
   */
  private async markRelatedSubmissionsStale(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    personId: string,
  ) {
    const participations = await tx.projectParticipant.findMany({
      where: { personId, organizationId: this.organizationId, deletedAt: null },
      select: { projectId: true },
    });
    if (participations.length === 0) return;

    const projectIds = participations.map((p) => p.projectId);

    await tx.programSubmission.updateMany({
      where: {
        organizationId: this.organizationId,
        status: { in: ['DRAFT', 'IN_REVIEW'] },
        isStale: false,
        projectProgram: { projectId: { in: projectIds } },
      },
      data: { isStale: true },
    });
  }

  /**
   * Prevents overlapping residency records for the same person (global, not project-scoped).
   * Open-ended records (effectiveTo = null) are treated as extending to infinity.
   */
  private async guardOverlap(
    personId: string,
    from: Date,
    to: Date | null,
    excludeId?: string,
  ) {
    const existing = await this.prisma.participantResidencyStatus.findMany({
      where: {
        personId,
        organizationId: this.organizationId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    for (const record of existing) {
      const rFrom = record.effectiveFrom;
      const rTo = record.effectiveTo;

      const newEndsBeforeExistingStarts = to !== null && to <= rFrom;
      const newStartsAfterExistingEnds = rTo !== null && from >= rTo;

      if (!newEndsBeforeExistingStarts && !newStartsAfterExistingEnds) {
        throw new BadRequestException(
          `Overlaps with existing residency record (${record.id}): ` +
          `${rFrom.toISOString().slice(0, 10)} – ${rTo?.toISOString().slice(0, 10) ?? 'ongoing'}`,
        );
      }
    }
  }
}
