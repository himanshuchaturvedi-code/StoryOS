import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ProjectProgramsService } from './project-programs.service';
import { ProjectProgramsController } from './project-programs.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ProjectProgramsController],
  providers: [ProjectProgramsService],
  exports: [ProjectProgramsService],
})
export class ProjectProgramsModule {}
