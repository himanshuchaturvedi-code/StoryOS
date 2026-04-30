import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantContext } from '../tenant/tenant.context';
import { PERMISSIONS } from '@storyos/types';

@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly tenantContext: TenantContext,
  ) {}

  // ── Public routes (no auth, no org context) ─────────────────────

  @Public()
  @Get('verify')
  async verify(@Query('token') token: string) {
    return this.invitations.verify(token);
  }

  @Public()
  @Post('accept')
  async accept(@Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(dto);
  }

  // ── Org-scoped routes (auth + tenant + permission) ──────────────

  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.INVITATION_CREATE)
  @Post()
  async create(@Body() dto: CreateInvitationDto) {
    return this.invitations.create(
      this.tenantContext.organizationId,
      this.tenantContext.userId,
      dto,
    );
  }

  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.INVITATION_LIST)
  @Get()
  async list() {
    return this.invitations.listForOrg(this.tenantContext.organizationId);
  }

  @UseGuards(TenantGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.INVITATION_REVOKE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string) {
    await this.invitations.revoke(this.tenantContext.organizationId, id);
  }
}
