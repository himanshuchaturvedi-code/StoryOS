import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import {
  CorporateOwnershipsService,
  ProjectOwnershipsService,
  RightsControlFactsService,
} from './ownerships.service';
import { CorporateOwnershipsController } from './corporate-ownerships.controller';
import { ProjectOwnershipsController } from './project-ownerships.controller';
import { RightsControlFactsController } from './rights-control-facts.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [
    CorporateOwnershipsController,
    ProjectOwnershipsController,
    RightsControlFactsController,
  ],
  providers: [CorporateOwnershipsService, ProjectOwnershipsService, RightsControlFactsService],
})
export class OwnershipsModule {}
