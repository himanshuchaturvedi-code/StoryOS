import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('members')
@UseGuards(TenantGuard, PermissionGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @RequirePermission(PERMISSIONS.ORG_READ)
  @Get()
  async list() {
    return this.members.list();
  }

  @RequirePermission(PERMISSIONS.ORG_MANAGE_MEMBERS)
  @Patch(':id')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateMemberRoleDto) {
    return this.members.updateRole(id, dto.role);
  }

  @RequirePermission(PERMISSIONS.ORG_MANAGE_MEMBERS)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.members.remove(id);
  }
}
