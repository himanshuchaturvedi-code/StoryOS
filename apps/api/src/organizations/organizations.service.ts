import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, type PrismaClient } from '@storyos/database';
import { INCENTIVE_REGIONS } from '@storyos/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/**
 * Manages Organization CRUD.
 *
 * Does NOT extend TenantAwareService because some methods are user-scoped
 * (listForUser, create) while others are org-scoped (findById, update, softDelete).
 * The Organization table is the tenant boundary itself, not tenant-scoped data.
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists organizations the user belongs to. User-scoped — no TenantContext. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, deletedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            createdAt: true,
          },
        },
      },
    });

    return memberships
      .filter((m) => m.organization !== null)
      .map((m) => ({
        ...m.organization,
        role: m.role,
      }));
  }

  /**
   * Creates an organization and makes the requesting user the OWNER.
   * User-scoped — no TenantContext needed.
   */
  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          type: (dto.type as any) ?? 'PRODUCTION_COMPANY',
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          role: 'OWNER',
        },
      });

      await this.provisionIncentiveRegionLocations(tx, org.id, userId);

      return org;
    });
  }

  /** Finds an org by ID. Called after TenantGuard validates membership. */
  async findById(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    await this.assertExists(orgId);

    return this.prisma.organization.update({
      where: { id: orgId },
      data: { ...dto, type: dto.type as any },
    });
  }

  async softDelete(orgId: string) {
    await this.assertExists(orgId);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: new Date() },
    });
  }

  private async assertExists(orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!org) throw new NotFoundException('Organization not found');
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    const slug = base || 'org';

    const existing = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) return slug;

    const suffix = Math.random().toString(36).substring(2, 7);
    return `${slug}-${suffix}`;
  }

  private async provisionIncentiveRegionLocations(
    tx: PrismaClient | Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ) {
    await tx.location.createMany({
      data: INCENTIVE_REGIONS.map((region) => ({
        organizationId,
        createdById: userId,
        name: region.label,
        country: 'CA',
        provinceState: region.provinceState,
        incentiveRegionCode: region.code,
      })),
    });
  }
}
