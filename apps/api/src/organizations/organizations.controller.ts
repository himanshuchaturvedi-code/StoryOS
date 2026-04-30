import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantContext } from '../tenant/tenant.context';
import { PERMISSIONS } from '@storyos/types';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly tenantContext: TenantContext,
  ) {}

  /** List organizations the authenticated user belongs to. No org context needed. */
  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.orgs.listForUser(user.id);
  }

  /** Create a new organization. The requesting user becomes OWNER. */
  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrganizationDto) {
    return this.orgs.create(user.id, dto);
  }

  /** Get current organization details (from X-Organization-Id header). */
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.ORG_READ)
  @Get('current')
  async getCurrent() {
    return this.orgs.findById(this.tenantContext.organizationId);
  }

  /** Update current organization. */
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.ORG_UPDATE)
  @Patch('current')
  async update(@Body() dto: UpdateOrganizationDto) {
    return this.orgs.update(this.tenantContext.organizationId, dto);
  }

  /** Soft-delete current organization. */
  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.ORG_DELETE)
  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove() {
    await this.orgs.softDelete(this.tenantContext.organizationId);
  }
}
