import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateActivityDayDto } from './dto/create-activity-day.dto';
import { UpdateActivityDayDto } from './dto/update-activity-day.dto';

@Injectable()
export class ActivityDaysService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(
    projectId: string,
    filters?: {
      personId?: string;
      locationId?: string;
      roleTypeId?: string;
      productionPhaseId?: string;
      from?: string;
      to?: string;
    },
  ) {
    await this.assertProjectExists(projectId);

    const dateFilter: Record<string, unknown> = {};
    if (filters?.from) dateFilter.gte = new Date(filters.from);
    if (filters?.to) dateFilter.lte = new Date(filters.to);

    return this.prisma.activityDay.findMany({
      where: this.tenantFilter({
        projectId,
        ...(filters?.personId ? { personId: filters.personId } : {}),
        ...(filters?.locationId ? { locationId: filters.locationId } : {}),
        ...(filters?.roleTypeId ? { roleTypeId: filters.roleTypeId } : {}),
        ...(filters?.productionPhaseId ? { productionPhaseId: filters.productionPhaseId } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { activityDate: dateFilter } : {}),
      }),
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        roleType: { select: { id: true, code: true, name: true, category: true } },
        location: { select: { id: true, name: true, country: true, provinceState: true, zoneCode: true } },
        productionPhase: { select: { id: true, phaseType: true, name: true } },
      },
      orderBy: { activityDate: 'asc' },
    });
  }

  async create(projectId: string, dto: CreateActivityDayDto) {
    await this.assertProjectExists(projectId);
    await this.assertPersonBelongsToOrg(dto.personId);
    await this.assertLocationBelongsToOrg(dto.locationId);
    await this.assertRoleTypeExists(dto.roleTypeId);
    if (dto.productionPhaseId) {
      await this.assertPhaseExists(projectId, dto.productionPhaseId);
    }

    return this.prisma.activityDay.create({
      data: this.tenantData({
        projectId,
        personId: dto.personId,
        roleTypeId: dto.roleTypeId,
        locationId: dto.locationId,
        productionPhaseId: dto.productionPhaseId ?? null,
        activityDate: new Date(dto.activityDate),
        hoursWorked: dto.hoursWorked ?? null,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        roleType: { select: { id: true, code: true, name: true, category: true } },
        location: { select: { id: true, name: true, country: true, provinceState: true, zoneCode: true } },
        productionPhase: { select: { id: true, phaseType: true, name: true } },
      },
    });
  }

  async update(projectId: string, activityDayId: string, dto: UpdateActivityDayDto) {
    await this.assertProjectExists(projectId);
    await this.assertActivityDayExists(projectId, activityDayId);

    if (dto.personId) await this.assertPersonBelongsToOrg(dto.personId);
    if (dto.locationId) await this.assertLocationBelongsToOrg(dto.locationId);
    if (dto.roleTypeId) await this.assertRoleTypeExists(dto.roleTypeId);
    if (dto.productionPhaseId) await this.assertPhaseExists(projectId, dto.productionPhaseId);

    const { activityDate, ...rest } = dto;
    return this.prisma.activityDay.update({
      where: { id: activityDayId },
      data: {
        ...rest,
        ...(activityDate !== undefined ? { activityDate: new Date(activityDate) } : {}),
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        roleType: { select: { id: true, code: true, name: true, category: true } },
        location: { select: { id: true, name: true, country: true, provinceState: true, zoneCode: true } },
        productionPhase: { select: { id: true, phaseType: true, name: true } },
      },
    });
  }

  async remove(projectId: string, activityDayId: string) {
    await this.assertActivityDayExists(projectId, activityDayId);
    await this.prisma.activityDay.delete({ where: { id: activityDayId } });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertActivityDayExists(projectId: string, activityDayId: string) {
    const record = await this.prisma.activityDay.findFirst({
      where: this.tenantFilter({ id: activityDayId, projectId }),
      select: { id: true },
    });
    if (!record) throw new NotFoundException('Activity day not found');
  }

  private async assertPersonBelongsToOrg(personId: string) {
    const person = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id: personId }),
      select: { id: true },
    });
    if (!person) throw new BadRequestException('Person not found in this organization');
  }

  private async assertLocationBelongsToOrg(locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: this.tenantFilter({ id: locationId }),
      select: { id: true },
    });
    if (!location) throw new BadRequestException('Location not found in this organization');
  }

  private async assertRoleTypeExists(roleTypeId: string) {
    const roleType = await this.prisma.participantRoleType.findUnique({
      where: { id: roleTypeId },
      select: { id: true },
    });
    if (!roleType) throw new BadRequestException('Participant role type not found');
  }

  private async assertPhaseExists(projectId: string, phaseId: string) {
    const phase = await this.prisma.productionPhase.findFirst({
      where: this.tenantFilter({ id: phaseId, projectId }),
      select: { id: true },
    });
    if (!phase) throw new BadRequestException('Production phase not found on this project');
  }
}
