import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { DerivedRolesController } from './derived-roles.controller';
import { DerivedRolesService } from './derived-roles.service';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [DerivedRolesController],
  providers: [DerivedRolesService],
  exports: [DerivedRolesService],
})
export class DerivedRolesModule {}
