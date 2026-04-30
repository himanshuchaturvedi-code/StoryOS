import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@storyos/database';
import { INCENTIVE_REGIONS } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { TenantContext } from '../tenant/tenant.context';
import { CreateActivityPlanDto } from './dto/create-activity-plan.dto';
import { UpdateActivityPlanDto } from './dto/update-activity-plan.dto';

const regionMap = new Map<string, (typeof INCENTIVE_REGIONS)[number]>(
  INCENTIVE_REGIONS.map((r) => [r.code, r]),
);

const LOCATION_SELECT = {
  id: true,
  name: true,
  country: true,
  provinceState: true,
  incentiveRegionCode: true,
} as const;

const PHASE_SELECT = {
  id: true,
  phaseType: true,
  name: true,
} as const;

const ACTIVITY_PLAN_INCLUDE = {
  location: { select: LOCATION_SELECT },
  productionPhase: { select: PHASE_SELECT },
} as const;

@Injectable()
export class ActivityPlansService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);

    return this.prisma.activityPlan.findMany({
      where: this.tenantFilter({ projectId }),
      include: ACTIVITY_PLAN_INCLUDE,
      orderBy: [{ productionPhaseId: 'asc' }, { locationId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(projectId: string, dto: CreateActivityPlanDto) {
    await this.assertProjectExists(projectId);
    const locationId = await this.resolveCanonicalLocation(dto.regionCode);
    await this.assertPhaseExists(projectId, dto.productionPhaseId);

    try {
      return await this.prisma.activityPlan.create({
        data: this.tenantData({
          projectId,
          locationId,
          productionPhaseId: dto.productionPhaseId,
          plannedDays: dto.plannedDays,
          notes: dto.notes ?? null,
        }),
        include: ACTIVITY_PLAN_INCLUDE,
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async update(projectId: string, activityPlanId: string, dto: UpdateActivityPlanDto) {
    await this.assertProjectExists(projectId);
    await this.assertActivityPlanExists(projectId, activityPlanId);

    let locationId: string | undefined;
    if (dto.regionCode) {
      locationId = await this.resolveCanonicalLocation(dto.regionCode);
    }
    if (dto.productionPhaseId) {
      await this.assertPhaseExists(projectId, dto.productionPhaseId);
    }

    try {
      return await this.prisma.activityPlan.update({
        where: { id: activityPlanId },
        data: {
          ...(locationId !== undefined ? { locationId } : {}),
          ...(dto.productionPhaseId !== undefined
            ? { productionPhaseId: dto.productionPhaseId }
            : {}),
          ...(dto.plannedDays !== undefined ? { plannedDays: dto.plannedDays } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
        include: ACTIVITY_PLAN_INCLUDE,
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async remove(projectId: string, activityPlanId: string) {
    await this.assertActivityPlanExists(projectId, activityPlanId);
    await this.prisma.activityPlan.delete({ where: { id: activityPlanId } });
  }

  /**
   * Resolves a region code to the canonical Location for this org.
   * Canonical locations are provisioned when the org is created.
   */
  private async resolveCanonicalLocation(regionCode: string): Promise<string> {
    const region = regionMap.get(regionCode);
    if (!region) {
      throw new BadRequestException(`Unknown incentive region code: ${regionCode}`);
    }

    const location = await this.prisma.location.findFirst({
      where: this.tenantFilter({
        incentiveRegionCode: regionCode,
      }),
      select: { id: true },
    });

    if (!location) {
      throw new BadRequestException(
        `Canonical location for region "${regionCode}" not found. ` +
          'Ensure incentive-region locations have been provisioned for this organization.',
      );
    }

    return location.id;
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertActivityPlanExists(projectId: string, activityPlanId: string) {
    const activityPlan = await this.prisma.activityPlan.findFirst({
      where: this.tenantFilter({ id: activityPlanId, projectId }),
      select: { id: true },
    });
    if (!activityPlan) throw new NotFoundException('Activity plan not found');
  }

  private async assertPhaseExists(projectId: string, phaseId: string) {
    const phase = await this.prisma.productionPhase.findFirst({
      where: this.tenantFilter({ id: phaseId, projectId }),
      select: { id: true },
    });
    if (!phase) {
      throw new BadRequestException('Production phase not found on this project');
    }
  }

  private rethrowConstraintError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Activity plan already exists for this location and production phase',
      );
    }
    throw error;
  }
}
