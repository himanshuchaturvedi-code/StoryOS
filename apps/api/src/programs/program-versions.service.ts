import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { asOf } from '@storyos/database';

/**
 * Program versions are global, temporal (effectiveFrom/effectiveTo).
 * "Current" is derived from time, not a boolean.
 */
@Injectable()
export class ProgramVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByProgram(programId: string) {
    await this.assertProgramExists(programId);
    return this.prisma.programVersion.findMany({
      where: { programId },
      include: {
        requirements: {
          select: {
            id: true,
            code: true,
            name: true,
            requirementCategory: true,
            isRequired: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findById(programId: string, versionId: string) {
    const version = await this.prisma.programVersion.findFirst({
      where: { id: versionId, programId },
      include: {
        program: {
          select: { id: true, code: true, name: true, scope: true, country: true },
        },
        requirements: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });
    if (!version) throw new NotFoundException('Program version not found');
    return version;
  }

  /**
   * Returns the version effective at the given date.
   * If multiple versions overlap (transition period), returns the most recently effective.
   */
  async currentForProgram(programId: string, asOfDate?: Date) {
    await this.assertProgramExists(programId);
    const date = asOfDate ?? new Date();
    const filter = asOf(date);

    const version = await this.prisma.programVersion.findFirst({
      where: {
        programId,
        effectiveFrom: filter.effectiveFrom,
        OR: filter.OR,
      },
      include: {
        program: {
          select: { id: true, code: true, name: true, scope: true, country: true },
        },
        requirements: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!version) throw new NotFoundException('No program version effective at the given date');
    return version;
  }

  private async assertProgramExists(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Program not found');
  }
}
