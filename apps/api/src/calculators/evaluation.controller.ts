import {
  Controller,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { EvaluationService } from './evaluation.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/programs/:projectProgramId/submissions/:submissionId')
export class EvaluationController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Post('evaluate')
  @RequirePermission(PERMISSIONS.ASSESSMENT_UPDATE)
  evaluate(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.evaluationService.evaluateSubmission(
      projectId,
      projectProgramId,
      submissionId,
    );
  }
}
