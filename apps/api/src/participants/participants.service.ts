import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class ParticipantsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  // ── Role types (global reference data) ──────────────────────────────────

  async listRoleTypes() {
    return this.prisma.participantRoleType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Project participants ─────────────────────────────────────────────────

  async listForProject(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.projectParticipant.findMany({
      where: this.tenantFilter({ projectId }),
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            citizenship: true,
          },
        },
        roles: {
          where: this.softDeleteFilter,
          include: {
            roleType: { select: { id: true, code: true, name: true, category: true } },
            productionPhase: { select: { id: true, name: true, phaseType: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(projectId: string, dto: AddParticipantDto) {
    await this.assertProjectExists(projectId);
    await this.assertPersonBelongsToOrg(dto.personId);

    const existing = await this.prisma.projectParticipant.findFirst({
      where: this.tenantFilter({ projectId, personId: dto.personId }),
    });
    if (existing) throw new ConflictException('Person is already a participant on this project');

    return this.prisma.projectParticipant.create({
      data: this.tenantData({
        projectId,
        personId: dto.personId,
        createdById: this.tenant.userId,
      }),
      include: {
        person: { select: { id: true, firstName: true, lastName: true, email: true } },
        roles: true,
      },
    });
  }

  async remove(projectId: string, participantId: string) {
    await this.assertProjectExists(projectId);
    const participant = await this.prisma.projectParticipant.findFirst({
      where: this.tenantFilter({ id: participantId, projectId }),
    });
    if (!participant) throw new NotFoundException('Participant not found');
    await this.prisma.projectParticipant.delete({ where: { id: participantId } });
  }

  // ── Participant roles ────────────────────────────────────────────────────

  async assignRole(projectId: string, participantId: string, dto: AssignRoleDto) {
    const participant = await this.prisma.projectParticipant.findFirst({
      where: this.tenantFilter({ id: participantId, projectId }),
    });
    if (!participant) throw new NotFoundException('Participant not found');

    const roleType = await this.prisma.participantRoleType.findUnique({
      where: { id: dto.roleTypeId },
    });
    if (!roleType) throw new BadRequestException('Invalid role type');

    if (dto.productionPhaseId) {
      const phase = await this.prisma.productionPhase.findFirst({
        where: this.tenantFilter({ id: dto.productionPhaseId, projectId }),
      });
      if (!phase) throw new BadRequestException('Invalid production phase');
    }

    // Guard before hitting the DB unique constraint to return a clean 409.
    const duplicateRole = await this.prisma.projectParticipantRole.findFirst({
      where: {
        projectParticipantId: participantId,
        roleTypeId: dto.roleTypeId,
        ...this.softDeleteFilter,
      },
    });
    if (duplicateRole) {
      throw new ConflictException(
        `This participant already has the role '${roleType.name}' on this project`,
      );
    }

    return this.prisma.projectParticipantRole.create({
      data: this.tenantData({
        projectParticipantId: participantId,
        roleTypeId: dto.roleTypeId,
        productionPhaseId: dto.productionPhaseId ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes ?? null,
      }),
      include: {
        roleType: { select: { id: true, code: true, name: true, category: true } },
        productionPhase: { select: { id: true, name: true } },
      },
    });
  }

  async removeRole(projectId: string, participantId: string, roleId: string) {
    const role = await this.prisma.projectParticipantRole.findFirst({
      where: {
        id: roleId,
        projectParticipantId: participantId,
        organizationId: this.organizationId,
        ...this.softDeleteFilter,
      },
    });
    if (!role) throw new NotFoundException('Role assignment not found');
    await this.prisma.projectParticipantRole.delete({ where: { id: roleId } });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertPersonBelongsToOrg(personId: string) {
    const person = await this.prisma.person.findFirst({
      where: this.tenantFilter({ id: personId }),
      select: { id: true },
    });
    if (!person) throw new BadRequestException('Person does not belong to this organization');
  }
}
