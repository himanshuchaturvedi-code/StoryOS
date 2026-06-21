import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ProgramApplicationsService } from './program-applications.service';
import { ProgramApplicationsController } from './program-applications.controller';
import { ProjectApplicationsController } from './project-applications.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ProgramApplicationsController, ProjectApplicationsController],
  providers: [ProgramApplicationsService],
  exports: [ProgramApplicationsService],
})
export class ProgramApplicationsModule {}
