import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateProductionPhaseDto } from './dto/create-phase.dto';
import { UpdateProductionPhaseDto } from './dto/update-phase.dto';

@Injectable()
export class ProductionPhasesService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);

    return this.prisma.productionPhase.findMany({
      where: this.tenantFilter({ projectId }),
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(projectId: string, dto: CreateProductionPhaseDto) {
    await this.assertProjectExists(projectId);

    return this.prisma.productionPhase.create({
      data: this.tenantData({
        projectId,
        createdById: this.tenant.userId,
        phaseType: dto.phaseType as any,
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes,
      }),
    });
  }

  async update(projectId: string, phaseId: string, dto: UpdateProductionPhaseDto) {
    await this.assertProjectExists(projectId);

    const phase = await this.prisma.productionPhase.findFirst({
      where: this.tenantFilter({ id: phaseId, projectId }),
    });

    if (!phase) throw new NotFoundException('Phase not found');

    return this.prisma.productionPhase.update({
      where: { id: phaseId },
      data: {
        ...(dto.phaseType && { phaseType: dto.phaseType as any }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(projectId: string, phaseId: string) {
    await this.assertProjectExists(projectId);

    const phase = await this.prisma.productionPhase.findFirst({
      where: this.tenantFilter({ id: phaseId, projectId }),
    });

    if (!phase) throw new NotFoundException('Phase not found');

    await this.prisma.productionPhase.delete({ where: { id: phaseId } });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
