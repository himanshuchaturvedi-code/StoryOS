import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProgramScope } from '@storyos/database';

/**
 * Programs are global reference data. No tenant filtering.
 * V1: read-only for tenants. Full CRUD deferred to platform-admin role.
 */
@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope?: string, isActive?: boolean) {
    const where: { scope?: ProgramScope; isActive?: boolean } = {};
    if (scope) where.scope = scope as ProgramScope;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.program.findMany({
      where,
      include: {
        versions: {
          select: {
            id: true,
            versionCode: true,
            name: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(programId: string) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      include: {
        versions: {
          select: {
            id: true,
            versionCode: true,
            name: true,
            effectiveFrom: true,
            effectiveTo: true,
            description: true,
            sourceDocumentUrl: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async findByCode(code: string) {
    const program = await this.prisma.program.findUnique({
      where: { code },
      include: {
        versions: {
          select: {
            id: true,
            versionCode: true,
            name: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }
}
