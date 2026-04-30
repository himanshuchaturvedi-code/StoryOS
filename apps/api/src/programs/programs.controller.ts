import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ProgramsService } from './programs.service';
import { ProgramVersionsService } from './program-versions.service';
import { ProgramRequirementsService } from './program-requirements.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly programsService: ProgramsService,
    private readonly versionsService: ProgramVersionsService,
    private readonly requirementsService: ProgramRequirementsService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  list(
    @Query('scope') scope?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.programsService.list(scope, isActiveBool);
  }

  @Get(':programId')
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  findOne(@Param('programId') programId: string) {
    return this.programsService.findById(programId);
  }

  @Get(':programId/versions')
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  listVersions(@Param('programId') programId: string) {
    return this.versionsService.listByProgram(programId);
  }

  @Get(':programId/versions/current')
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  currentVersion(
    @Param('programId') programId: string,
    @Query('asOf') asOf?: string,
  ) {
    const asOfDate = asOf ? new Date(asOf) : undefined;
    return this.versionsService.currentForProgram(programId, asOfDate);
  }

  @Get(':programId/versions/:versionId')
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  findVersion(
    @Param('programId') programId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.versionsService.findById(programId, versionId);
  }

  @Get(':programId/versions/:versionId/requirements')
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  listRequirements(
    @Param('programId') programId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.requirementsService.listByVersion(programId, versionId);
  }

  @Get(':programId/versions/:versionId/requirements/:requirementId')
  @RequirePermission(PERMISSIONS.PROGRAM_READ)
  findRequirement(
    @Param('programId') programId: string,
    @Param('versionId') versionId: string,
    @Param('requirementId') requirementId: string,
  ) {
    return this.requirementsService.findById(programId, versionId, requirementId);
  }
}
