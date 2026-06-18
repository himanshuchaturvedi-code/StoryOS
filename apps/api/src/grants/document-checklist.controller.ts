import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@storyos/types';

import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

import { DocumentChecklistService } from './document-checklist.service';
import type { DocumentChecklistResponse } from './document-checklist.types';

/**
 * Read-only program document checklist.
 *
 * Route uses `by-code/:programCode` to avoid colliding with
 * `projects/:projectId/programs/:projectProgramId` (UUID) routes.
 */
@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/programs/by-code/:programCode')
export class DocumentChecklistController {
  constructor(private readonly documentChecklistService: DocumentChecklistService) {}

  @Get('document-checklist')
  @RequirePermission(PERMISSIONS.PROJECT_PROGRAM_READ)
  getChecklist(
    @Param('projectId') projectId: string,
    @Param('programCode') programCode: string,
  ): Promise<DocumentChecklistResponse> {
    return this.documentChecklistService.getChecklist(projectId, programCode);
  }
}
