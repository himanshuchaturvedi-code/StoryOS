import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { VendorsService } from './vendors.service';
import { VendorEligibilityService } from './vendor-eligibility.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { CreateVendorEligibilityDto } from './dto/create-vendor-eligibility.dto';
import { UpdateVendorEligibilityDto } from './dto/update-vendor-eligibility.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('vendors')
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly eligibilityService: VendorEligibilityService,
  ) {}

  // ── Vendors ─────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(PERMISSIONS.VENDOR_READ)
  list(@Query('vendorType') vendorType?: string) {
    return this.vendorsService.list(vendorType);
  }

  @Post()
  @RequirePermission(PERMISSIONS.VENDOR_CREATE)
  create(@Body() dto: CreateVendorDto) {
    return this.vendorsService.create(dto);
  }

  @Get(':vendorId')
  @RequirePermission(PERMISSIONS.VENDOR_READ)
  findOne(@Param('vendorId') vendorId: string) {
    return this.vendorsService.findById(vendorId);
  }

  @Patch(':vendorId')
  @RequirePermission(PERMISSIONS.VENDOR_UPDATE)
  update(@Param('vendorId') vendorId: string, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.update(vendorId, dto);
  }

  @Delete(':vendorId')
  @RequirePermission(PERMISSIONS.VENDOR_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('vendorId') vendorId: string) {
    return this.vendorsService.remove(vendorId);
  }

  // ── Vendor Eligibility ───────────────────────────────────────────────────────

  @Get(':vendorId/eligibilities')
  @RequirePermission(PERMISSIONS.VENDOR_ELIGIBILITY_READ)
  listEligibilities(@Param('vendorId') vendorId: string) {
    return this.eligibilityService.list(vendorId);
  }

  @Post(':vendorId/eligibilities')
  @RequirePermission(PERMISSIONS.VENDOR_ELIGIBILITY_CREATE)
  createEligibility(
    @Param('vendorId') vendorId: string,
    @Body() dto: CreateVendorEligibilityDto,
  ) {
    return this.eligibilityService.create(vendorId, dto);
  }

  @Get(':vendorId/eligibilities/current')
  @RequirePermission(PERMISSIONS.VENDOR_ELIGIBILITY_READ)
  currentEligibility(
    @Param('vendorId') vendorId: string,
    @Query('programCode') programCode: string,
  ) {
    return this.eligibilityService.currentForProgram(vendorId, programCode);
  }

  @Patch(':vendorId/eligibilities/:eligibilityId')
  @RequirePermission(PERMISSIONS.VENDOR_ELIGIBILITY_UPDATE)
  updateEligibility(
    @Param('vendorId') vendorId: string,
    @Param('eligibilityId') eligibilityId: string,
    @Body() dto: UpdateVendorEligibilityDto,
  ) {
    return this.eligibilityService.update(vendorId, eligibilityId, dto);
  }

  @Delete(':vendorId/eligibilities/:eligibilityId')
  @RequirePermission(PERMISSIONS.VENDOR_ELIGIBILITY_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEligibility(
    @Param('vendorId') vendorId: string,
    @Param('eligibilityId') eligibilityId: string,
  ) {
    return this.eligibilityService.remove(vendorId, eligibilityId);
  }
}
