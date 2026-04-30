import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAccessController } from './project-access.controller';
import { ProjectAccessService } from './project-access.service';
import { ProjectMetadataController } from './project-metadata.controller';
import { ProjectMetadataService } from './project-metadata.service';
import { ProjectFormatController } from './project-format.controller';
import { ProjectFormatService } from './project-format.service';
import { ProjectStagesController } from './project-stages.controller';
import { ProjectStagesService } from './project-stages.service';
import { ProductionPhasesController } from './production-phases.controller';
import { ProductionPhasesService } from './production-phases.service';
import { ProjectMilestonesController } from './project-milestones.controller';
import { ProjectMilestonesService } from './project-milestones.service';

@Module({
  imports: [TenantModule],
  controllers: [
    ProjectsController,
    ProjectAccessController,
    ProjectMetadataController,
    ProjectFormatController,
    ProjectStagesController,
    ProductionPhasesController,
    ProjectMilestonesController,
  ],
  providers: [
    ProjectsService,
    ProjectAccessService,
    ProjectMetadataService,
    ProjectFormatService,
    ProjectStagesService,
    ProductionPhasesService,
    ProjectMilestonesService,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
