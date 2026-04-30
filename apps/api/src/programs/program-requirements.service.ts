import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Program requirements are global. Each requirementCategory maps to
 * a Phase 5 calculator function. configuration JSONB holds typed parameters.
 */
@Injectable()
export class ProgramRequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByVersion(programId: string, versionId: string) {
    await this.assertVersionExists(programId, versionId);
    return this.prisma.programRequirement.findMany({
      where: { programVersionId: versionId },
      include: {
        parent: {
          select: { id: true, code: true, name: true },
        },
        children: {
          select: { id: true, code: true, name: true, requirementCategory: true, sortOrder: true },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async findById(programId: string, versionId: string, requirementId: string) {
    const requirement = await this.prisma.programRequirement.findFirst({
      where: {
        id: requirementId,
        programVersionId: versionId,
        programVersion: { programId },
      },
      include: {
        programVersion: {
          select: { id: true, versionCode: true, name: true, programId: true },
        },
        parent: true,
        children: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });
    if (!requirement) throw new NotFoundException('Program requirement not found');
    return requirement;
  }

  private async assertVersionExists(programId: string, versionId: string) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: versionId, programId },
      select: { id: true },
    });
    if (!version) throw new NotFoundException('Program version not found');
  }
}
