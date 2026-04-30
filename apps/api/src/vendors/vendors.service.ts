import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

@Injectable()
export class VendorsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(vendorType?: string) {
    return this.prisma.vendor.findMany({
      where: this.tenantFilter(vendorType ? { vendorType: vendorType as never } : {}),
      include: {
        eligibilities: {
          where: this.softDeleteFilter,
          orderBy: { effectiveFrom: 'desc' },
        },
      },
      orderBy: [{ vendorType: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: this.tenantFilter({ id: vendorId }),
      include: {
        eligibilities: {
          where: this.softDeleteFilter,
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: this.tenantData({
        name: dto.name,
        vendorType: dto.vendorType,
        legalName: dto.legalName ?? null,
        registrationNum: dto.registrationNum ?? null,
        country: dto.country,
        provinceState: dto.provinceState ?? null,
        city: dto.city ?? null,
        postalCode: dto.postalCode ?? null,
        isCanadianOwned: dto.isCanadianOwned ?? null,
        principalPersonId: dto.principalPersonId ?? null,
        isRelatedParty: dto.isRelatedParty ?? null,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
    });
  }

  async update(vendorId: string, dto: UpdateVendorDto) {
    await this.assertVendorExists(vendorId);
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: dto,
    });
  }

  async remove(vendorId: string) {
    await this.assertVendorExists(vendorId);
    await this.prisma.vendor.delete({ where: { id: vendorId } });
  }

  async assertVendorExists(vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: this.tenantFilter({ id: vendorId }),
      select: { id: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
  }
}
