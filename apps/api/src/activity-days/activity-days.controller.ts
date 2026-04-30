import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ActivityDaysService } from './activity-days.service';
import { ParticipantResidencyService } from './participant-residency.service';
import { CreateActivityDayDto } from './dto/create-activity-day.dto';
import { UpdateActivityDayDto } from './dto/update-activity-day.dto';
import { CreateResidencyStatusDto } from './dto/create-residency-status.dto';
import { UpdateResidencyStatusDto } from './dto/update-residency-status.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId')
export class ActivityDaysController {
  constructor(
    private readonly activityDaysService: ActivityDaysService,
    private readonly residencyService: ParticipantResidencyService,
  ) {}

  // ── Activity Days ────────────────────────────────────────────────────────────

  @Get('activity-days')
  @RequirePermission(PERMISSIONS.ACTIVITY_DAY_READ)
  list(
    @Param('projectId') projectId: string,
    @Query('personId') personId?: string,
    @Query('locationId') locationId?: string,
    @Query('roleTypeId') roleTypeId?: string,
    @Query('productionPhaseId') productionPhaseId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.activityDaysService.list(projectId, {
      personId,
      locationId,
      roleTypeId,
      productionPhaseId,
      from,
      to,
    });
  }

  @Post('activity-days')
  @RequirePermission(PERMISSIONS.ACTIVITY_DAY_CREATE)
  createActivityDay(
    @Param('projectId') projectId: string,
    @Body() dto: CreateActivityDayDto,
  ) {
    return this.activityDaysService.create(projectId, dto);
  }

  @Patch('activity-days/:activityDayId')
  @RequirePermission(PERMISSIONS.ACTIVITY_DAY_UPDATE)
  updateActivityDay(
    @Param('projectId') projectId: string,
    @Param('activityDayId') activityDayId: string,
    @Body() dto: UpdateActivityDayDto,
  ) {
    return this.activityDaysService.update(projectId, activityDayId, dto);
  }

  @Delete('activity-days/:activityDayId')
  @RequirePermission(PERMISSIONS.ACTIVITY_DAY_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeActivityDay(
    @Param('projectId') projectId: string,
    @Param('activityDayId') activityDayId: string,
  ) {
    return this.activityDaysService.remove(projectId, activityDayId);
  }

  // ── Participant Residency ────────────────────────────────────────────────────

  @Get('residencies')
  @RequirePermission(PERMISSIONS.RESIDENCY_READ)
  listResidencies(@Param('projectId') projectId: string) {
    return this.residencyService.listForProject(projectId);
  }

  @Get('residencies/person/:personId')
  @RequirePermission(PERMISSIONS.RESIDENCY_READ)
  listForPerson(
    @Param('projectId') projectId: string,
    @Param('personId') personId: string,
  ) {
    return this.residencyService.listForPerson(projectId, personId);
  }

  @Post('residencies')
  @RequirePermission(PERMISSIONS.RESIDENCY_CREATE)
  createResidency(
    @Param('projectId') projectId: string,
    @Body() dto: CreateResidencyStatusDto,
  ) {
    return this.residencyService.create(projectId, dto);
  }

  @Patch('residencies/:residencyId')
  @RequirePermission(PERMISSIONS.RESIDENCY_UPDATE)
  updateResidency(
    @Param('projectId') projectId: string,
    @Param('residencyId') residencyId: string,
    @Body() dto: UpdateResidencyStatusDto,
  ) {
    return this.residencyService.update(projectId, residencyId, dto);
  }

  @Delete('residencies/:residencyId')
  @RequirePermission(PERMISSIONS.RESIDENCY_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeResidency(
    @Param('projectId') projectId: string,
    @Param('residencyId') residencyId: string,
  ) {
    return this.residencyService.remove(projectId, residencyId);
  }
}
