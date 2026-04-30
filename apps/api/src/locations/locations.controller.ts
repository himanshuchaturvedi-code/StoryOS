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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LinkLocationDto } from './dto/link-location.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller()
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ── Org-level location library ────────────────────────────────────────

  @Get('locations')
  @RequirePermission(PERMISSIONS.LOCATION_READ)
  list(@Query('country') country?: string) {
    return this.locationsService.list(country);
  }

  @Get('locations/:id')
  @RequirePermission(PERMISSIONS.LOCATION_READ)
  findOne(@Param('id') id: string) {
    return this.locationsService.findById(id);
  }

  @Post('locations')
  @RequirePermission(PERMISSIONS.LOCATION_CREATE)
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Patch('locations/:id')
  @RequirePermission(PERMISSIONS.LOCATION_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete('locations/:id')
  @RequirePermission(PERMISSIONS.LOCATION_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }

  // ── Project-location links ────────────────────────────────────────────

  @Get('projects/:projectId/locations')
  @RequirePermission(PERMISSIONS.LOCATION_READ)
  listForProject(@Param('projectId') projectId: string) {
    return this.locationsService.listForProject(projectId);
  }

  @Post('projects/:projectId/locations')
  @RequirePermission(PERMISSIONS.LOCATION_CREATE)
  link(@Param('projectId') projectId: string, @Body() dto: LinkLocationDto) {
    return this.locationsService.link(projectId, dto);
  }

  @Patch('projects/:projectId/locations/:projectLocationId/primary')
  @RequirePermission(PERMISSIONS.LOCATION_UPDATE)
  setPrimary(
    @Param('projectId') projectId: string,
    @Param('projectLocationId') projectLocationId: string,
  ) {
    return this.locationsService.setPrimary(projectId, projectLocationId);
  }

  @Delete('projects/:projectId/locations/:projectLocationId')
  @RequirePermission(PERMISSIONS.LOCATION_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(
    @Param('projectId') projectId: string,
    @Param('projectLocationId') projectLocationId: string,
  ) {
    return this.locationsService.unlink(projectId, projectLocationId);
  }
}
