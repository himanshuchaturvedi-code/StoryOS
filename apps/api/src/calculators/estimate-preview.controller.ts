import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@storyos/types';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EstimatePreviewDto } from './dto/estimate-preview.dto';
import { EstimatePreviewService } from './estimate-preview.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId')
export class EstimatePreviewController {
  constructor(private readonly previewService: EstimatePreviewService) {}

  @Post('estimate-preview')
  @RequirePermission(PERMISSIONS.ASSESSMENT_READ)
  preview(
    @Param('projectId') projectId: string,
    @Body() dto: EstimatePreviewDto,
  ) {
    return this.previewService.preview(
      projectId,
      dto.programIds,
      dto.budgetVersionId,
    );
  }
}
