import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LinkLocationDto } from './dto/link-location.dto';
import { normalizeProvinceStateForCountry } from '@storyos/types';

@Injectable()
export class LocationsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  // ── Org-level location library ────────────────────────────────────────

  async list(country?: string) {
    return this.prisma.location.findMany({
      where: this.tenantFilter(country ? { country } : {}),
      orderBy: [{ country: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    const location = await this.prisma.location.findFirst({
      where: this.tenantFilter({ id }),
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async create(dto: CreateLocationDto) {
    if (dto.zoneCode) {
      console.warn(`[Safeguard] Deprecated zoneCode "${dto.zoneCode}" used in location creation`);
    }
    const np = normalizeProvinceStateForCountry(dto.country, dto.provinceState);
    if (!np.ok) throw new BadRequestException(np.message);
    return this.prisma.location.create({
      data: this.tenantData({
        ...dto,
        provinceState: np.value,
        createdById: this.tenant.userId,
      }),
    });
  }

  async update(id: string, dto: UpdateLocationDto) {
    if (dto.zoneCode) {
      console.warn(`[Safeguard] Deprecated zoneCode "${dto.zoneCode}" used in location update`);
    }
    const location = await this.findById(id);
    const nextCountry = dto.country ?? location.country;
    const nextProvince =
      dto.provinceState !== undefined ? dto.provinceState : (location.provinceState ?? undefined);
    const merged = normalizeProvinceStateForCountry(nextCountry, nextProvince);
    if (!merged.ok) throw new BadRequestException(merged.message);

    const { provinceState: _ps, ...rest } = dto;
    return this.prisma.location.update({
      where: { id },
      data: {
        ...rest,
        ...(dto.provinceState !== undefined ? { provinceState: merged.value } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.location.delete({ where: { id } });
  }

  // ── Project-location links ────────────────────────────────────────────

  async listForProject(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.projectLocation.findMany({
      where: this.tenantFilter({ projectId }),
      include: { location: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async link(projectId: string, dto: LinkLocationDto) {
    await this.assertProjectExists(projectId);

    // Verify the location belongs to this org
    const location = await this.prisma.location.findFirst({
      where: this.tenantFilter({ id: dto.locationId }),
    });
    if (!location) throw new BadRequestException('Location does not belong to this organization');

    const existing = await this.prisma.projectLocation.findFirst({
      where: this.tenantFilter({ projectId, locationId: dto.locationId }),
    });
    if (existing) throw new ConflictException('Location is already linked to this project');

    // Soft-deleted links still occupy @@unique([projectId, locationId]). Unlink uses soft delete,
    // so re-linking the same location must restore the row instead of inserting a duplicate.
    const previouslyUnlinked = await this.prisma.projectLocation.findFirst({
      where: {
        organizationId: this.organizationId,
        projectId,
        locationId: dto.locationId,
        deletedAt: { not: null },
      },
    });

    // If this link is primary, clear any existing primary for the project
    if (dto.isPrimary) {
      await this.clearPrimary(projectId);
    }

    if (previouslyUnlinked) {
      return this.prisma.projectLocation.update({
        where: { id: previouslyUnlinked.id },
        data: {
          deletedAt: null,
          isPrimary: dto.isPrimary ?? false,
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        include: { location: true },
      });
    }

    return this.prisma.projectLocation.create({
      data: this.tenantData({
        projectId,
        locationId: dto.locationId,
        isPrimary: dto.isPrimary ?? false,
        notes: dto.notes ?? null,
      }),
      include: { location: true },
    });
  }

  async setPrimary(projectId: string, projectLocationId: string) {
    const link = await this.prisma.projectLocation.findFirst({
      where: this.tenantFilter({ id: projectLocationId, projectId }),
    });
    if (!link) throw new NotFoundException('Project location link not found');

    await this.clearPrimary(projectId);
    return this.prisma.projectLocation.update({
      where: { id: projectLocationId },
      data: { isPrimary: true },
      include: { location: true },
    });
  }

  async unlink(projectId: string, projectLocationId: string) {
    const link = await this.prisma.projectLocation.findFirst({
      where: this.tenantFilter({ id: projectLocationId, projectId }),
    });
    if (!link) throw new NotFoundException('Project location link not found');
    await this.prisma.projectLocation.delete({ where: { id: projectLocationId } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async clearPrimary(projectId: string) {
    await this.prisma.projectLocation.updateMany({
      where: this.tenantFilter({ projectId, isPrimary: true }),
      data: { isPrimary: false },
    });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

}
