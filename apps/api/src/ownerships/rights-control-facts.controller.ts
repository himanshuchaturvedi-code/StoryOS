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
import { RightsControlFactsService } from './ownerships.service';
import { CreateRightsControlFactDto } from './dto/create-rights-control-fact.dto';
import { UpdateRightsControlFactDto } from './dto/update-rights-control-fact.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/rights-control')
export class RightsControlFactsController {
  constructor(private readonly service: RightsControlFactsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.RIGHTS_CONTROL_READ)
  list(
    @Param('projectId') projectId: string,
    @Query('controlType') controlType?: string,
  ) {
    return this.service.list(projectId, controlType);
  }

  @Post()
  @RequirePermission(PERMISSIONS.RIGHTS_CONTROL_CREATE)
  create(@Param('projectId') projectId: string, @Body() dto: CreateRightsControlFactDto) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.RIGHTS_CONTROL_UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRightsControlFactDto,
  ) {
    return this.service.update(projectId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.RIGHTS_CONTROL_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.remove(projectId, id);
  }
}
