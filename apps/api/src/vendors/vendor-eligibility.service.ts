import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { VendorsService } from './vendors.service';
import { currentlyEffective, asOf } from '@storyos/database';
import { CreateVendorEligibilityDto } from './dto/create-vendor-eligibility.dto';
import { UpdateVendorEligibilityDto } from './dto/update-vendor-eligibility.dto';

@Injectable()
export class VendorEligibilityService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly vendorsService: VendorsService,
  ) {
    super(prisma, tenant);
  }

  async list(vendorId: string) {
    await this.vendorsService.assertVendorExists(vendorId);
    return this.prisma.vendorEligibility.findMany({
      where: this.tenantFilter({ vendorId }),
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async currentForProgram(vendorId: string, programCode: string) {
    await this.vendorsService.assertVendorExists(vendorId);
    return this.prisma.vendorEligibility.findFirst({
      where: {
        ...this.tenantFilter({ vendorId, programCode }),
        ...currentlyEffective(),
      },
    });
  }

  async atDateForProgram(vendorId: string, programCode: string, date: Date) {
    await this.vendorsService.assertVendorExists(vendorId);
    return this.prisma.vendorEligibility.findFirst({
      where: {
        ...this.tenantFilter({ vendorId, programCode }),
        ...asOf(date),
      },
    });
  }

  async create(vendorId: string, dto: CreateVendorEligibilityDto) {
    await this.vendorsService.assertVendorExists(vendorId);

    const from = new Date(dto.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    await this.assertNoOverlap(vendorId, dto.programCode, from, to, undefined);

    return this.prisma.vendorEligibility.create({
      data: this.tenantData({
        vendorId,
        programCode: dto.programCode,
        status: dto.status ?? 'UNDER_REVIEW',
        effectiveFrom: from,
        effectiveTo: to,
        certificationRef: dto.certificationRef ?? null,
        notes: dto.notes ?? null,
      }),
    });
  }

  async update(vendorId: string, eligibilityId: string, dto: UpdateVendorEligibilityDto) {
    await this.vendorsService.assertVendorExists(vendorId);
    const existing = await this.assertEligibilityExists(vendorId, eligibilityId);

    const from = dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom;
    const to = dto.effectiveTo !== undefined
      ? (dto.effectiveTo ? new Date(dto.effectiveTo) : null)
      : existing.effectiveTo;

    if (dto.effectiveFrom || dto.effectiveTo !== undefined) {
      await this.assertNoOverlap(vendorId, existing.programCode, from, to, eligibilityId);
    }

    return this.prisma.vendorEligibility.update({
      where: { id: eligibilityId },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.effectiveFrom !== undefined && { effectiveFrom: from }),
        ...(dto.effectiveTo !== undefined && { effectiveTo: to }),
        ...(dto.certificationRef !== undefined && { certificationRef: dto.certificationRef }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(vendorId: string, eligibilityId: string) {
    await this.vendorsService.assertVendorExists(vendorId);
    await this.assertEligibilityExists(vendorId, eligibilityId);
    await this.prisma.vendorEligibility.delete({ where: { id: eligibilityId } });
  }

  /**
   * Prevents overlapping date ranges for the same vendor + program combination.
   * Two ranges overlap if they share any point in time.
   * Range [A_from, A_to) overlaps [B_from, B_to) when:
   *   A_from < B_to AND B_from < A_to   (treating null as infinity)
   */
  private async assertNoOverlap(
    vendorId: string,
    programCode: string,
    from: Date,
    to: Date | null,
    excludeId: string | undefined,
  ) {
    const existing = await this.prisma.vendorEligibility.findMany({
      where: {
        ...this.tenantFilter({ vendorId, programCode }),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Overlap condition: existing.from < to (or to is null) AND from < existing.to (or existing.to is null)
        AND: [
          to ? { effectiveFrom: { lt: to } } : {},
          { OR: [{ effectiveTo: null }, { effectiveTo: { gt: from } }] },
        ],
      },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
    });

    if (existing.length > 0) {
      throw new ConflictException(
        `This eligibility record overlaps with an existing record for program '${programCode}'. ` +
          'Close the existing record first by setting its effectiveTo before creating a new one.',
      );
    }
  }

  private async assertEligibilityExists(vendorId: string, eligibilityId: string) {
    const record = await this.prisma.vendorEligibility.findFirst({
      where: this.tenantFilter({ id: eligibilityId, vendorId }),
    });
    if (!record) throw new NotFoundException('Vendor eligibility record not found');
    return record;
  }
}
