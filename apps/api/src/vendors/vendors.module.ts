import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { VendorsService } from './vendors.service';
import { VendorEligibilityService } from './vendor-eligibility.service';
import { VendorsController } from './vendors.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorEligibilityService],
  exports: [VendorsService],
})
export class VendorsModule {}
