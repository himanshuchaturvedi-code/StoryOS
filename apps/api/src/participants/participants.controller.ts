import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ParticipantsService } from './participants.service';
import { AddParticipantDto } from './dto/add-participant.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

/**
 * GET /participant-role-types is intentionally @Public because these are
 * global read-only reference data. No tenant context is needed.
 */
@Controller()
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  // ── Global reference data ─────────────────────────────────────────────

  @Get('participant-role-types')
  @Public()
  listRoleTypes() {
    return this.participantsService.listRoleTypes();
  }

  // ── Project-scoped participants ───────────────────────────────────────

  @UseGuards(TenantGuard, PermissionGuard)
  @Get('projects/:projectId/participants')
  @RequirePermission(PERMISSIONS.PARTICIPANT_READ)
  list(@Param('projectId') projectId: string) {
    return this.participantsService.listForProject(projectId);
  }

  @UseGuards(TenantGuard, PermissionGuard)
  @Post('projects/:projectId/participants')
  @RequirePermission(PERMISSIONS.PARTICIPANT_CREATE)
  add(@Param('projectId') projectId: string, @Body() dto: AddParticipantDto) {
    return this.participantsService.add(projectId, dto);
  }

  @UseGuards(TenantGuard, PermissionGuard)
  @Delete('projects/:projectId/participants/:participantId')
  @RequirePermission(PERMISSIONS.PARTICIPANT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('projectId') projectId: string, @Param('participantId') participantId: string) {
    return this.participantsService.remove(projectId, participantId);
  }

  // ── Participant roles ─────────────────────────────────────────────────

  @UseGuards(TenantGuard, PermissionGuard)
  @Post('projects/:projectId/participants/:participantId/roles')
  @RequirePermission(PERMISSIONS.PARTICIPANT_CREATE)
  assignRole(
    @Param('projectId') projectId: string,
    @Param('participantId') participantId: string,
    @Body() dto: AssignRoleDto,
  ) {
    console.warn(`[DEPRECATION WARNING] Participant role assignment is deprecated. Roles will be derived from budget lines. (ProjectId: ${projectId}, ParticipantId: ${participantId})`);
    return this.participantsService.assignRole(projectId, participantId, dto);
  }

  @UseGuards(TenantGuard, PermissionGuard)
  @Delete('projects/:projectId/participants/:participantId/roles/:roleId')
  @RequirePermission(PERMISSIONS.PARTICIPANT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRole(
    @Param('projectId') projectId: string,
    @Param('participantId') participantId: string,
    @Param('roleId') roleId: string,
  ) {
    console.warn(`[DEPRECATION WARNING] Participant role removal is deprecated. Roles will be derived from budget lines. (ProjectId: ${projectId}, ParticipantId: ${participantId}, RoleId: ${roleId})`);
    return this.participantsService.removeRole(projectId, participantId, roleId);
  }
}
