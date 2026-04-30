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
import { CorporateOwnershipsService } from './ownerships.service';
import { CreateCorporateOwnershipDto } from './dto/create-corporate-ownership.dto';
import { UpdateCorporateOwnershipDto } from './dto/update-corporate-ownership.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('corporate-ownerships')
export class CorporateOwnershipsController {
  constructor(private readonly service: CorporateOwnershipsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.OWNERSHIP_READ)
  list(
    @Query('childEntityName') childEntityName?: string,
    @Query('parentEntityName') parentEntityName?: string,
  ) {
    return this.service.list({ childEntityName, parentEntityName });
  }

  @Get('current')
  @RequirePermission(PERMISSIONS.OWNERSHIP_READ)
  current(@Query('childEntityName') childEntityName: string) {
    return this.service.currentOwnersOf(childEntityName);
  }

  @Post()
  @RequirePermission(PERMISSIONS.OWNERSHIP_CREATE)
  create(@Body() dto: CreateCorporateOwnershipDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.OWNERSHIP_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateCorporateOwnershipDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.OWNERSHIP_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
