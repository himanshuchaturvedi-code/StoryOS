import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ProgramsService } from './programs.service';
import { ProgramVersionsService } from './program-versions.service';
import { ProgramRequirementsService } from './program-requirements.service';
import { ProgramsController } from './programs.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramVersionsService, ProgramRequirementsService],
  exports: [ProgramsService, ProgramVersionsService, ProgramRequirementsService],
})
export class ProgramsModule {}
