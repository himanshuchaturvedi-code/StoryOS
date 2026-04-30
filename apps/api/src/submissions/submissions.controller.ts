import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { SubmissionsService } from './submissions.service';
import { SubmissionEvidenceService } from './submission-evidence.service';
import { SubmissionAccountSourcesService } from './submission-account-sources.service';
import { RequirementAssessmentsService } from './requirement-assessments.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateEvidenceDto } from './dto/update-evidence.dto';
import { SetAccountSourcesDto } from './dto/set-account-sources.dto';
import { OverrideAssessmentDto } from './dto/override-assessment.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/programs/:projectProgramId/submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly evidenceService: SubmissionEvidenceService,
    private readonly accountSourcesService: SubmissionAccountSourcesService,
    private readonly assessmentsService: RequirementAssessmentsService,
  ) {}

  // ── Submissions ───────────────────────────────────────────────────────

  @Get()
  @RequirePermission(PERMISSIONS.SUBMISSION_READ)
  list(@Param('projectProgramId') projectProgramId: string) {
    return this.submissionsService.list(projectProgramId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.SUBMISSION_CREATE)
  create(
    @Param('projectProgramId') projectProgramId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.submissionsService.create(projectProgramId, dto);
  }

  @Get(':submissionId')
  @RequirePermission(PERMISSIONS.SUBMISSION_READ)
  findOne(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissionsService.findById(projectProgramId, submissionId);
  }

  @Patch(':submissionId')
  @RequirePermission(PERMISSIONS.SUBMISSION_UPDATE)
  update(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    return this.submissionsService.update(projectProgramId, submissionId, dto);
  }

  @Delete(':submissionId')
  @RequirePermission(PERMISSIONS.SUBMISSION_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.submissionsService.remove(projectProgramId, submissionId);
  }

  // ── Evidence ──────────────────────────────────────────────────────────

  @Get(':submissionId/evidence')
  @RequirePermission(PERMISSIONS.EVIDENCE_READ)
  listEvidence(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.evidenceService.list(projectProgramId, submissionId);
  }

  @Post(':submissionId/evidence')
  @RequirePermission(PERMISSIONS.EVIDENCE_CREATE)
  createEvidence(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: CreateEvidenceDto,
  ) {
    return this.evidenceService.create(projectProgramId, submissionId, dto);
  }

  @Get(':submissionId/evidence/:evidenceId')
  @RequirePermission(PERMISSIONS.EVIDENCE_READ)
  findEvidence(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.evidenceService.findById(projectProgramId, submissionId, evidenceId);
  }

  @Patch(':submissionId/evidence/:evidenceId')
  @RequirePermission(PERMISSIONS.EVIDENCE_UPDATE)
  updateEvidence(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Param('evidenceId') evidenceId: string,
    @Body() dto: UpdateEvidenceDto,
  ) {
    return this.evidenceService.update(projectProgramId, submissionId, evidenceId, dto);
  }

  @Delete(':submissionId/evidence/:evidenceId')
  @RequirePermission(PERMISSIONS.EVIDENCE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEvidence(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    return this.evidenceService.remove(projectProgramId, submissionId, evidenceId);
  }

  // ── Account Sources (Blended mode) ──────────────────────────────────

  @Get(':submissionId/account-sources')
  @RequirePermission(PERMISSIONS.SUBMISSION_READ)
  listAccountSources(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.accountSourcesService.list(projectProgramId, submissionId);
  }

  @Patch(':submissionId/account-sources')
  @RequirePermission(PERMISSIONS.SUBMISSION_UPDATE)
  setAccountSources(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: SetAccountSourcesDto,
  ) {
    return this.accountSourcesService.set(projectProgramId, submissionId, dto);
  }

  // ── Assessments ───────────────────────────────────────────────────────

  @Get(':submissionId/assessments')
  @RequirePermission(PERMISSIONS.ASSESSMENT_READ)
  listAssessments(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.assessmentsService.list(projectProgramId, submissionId);
  }

  @Post(':submissionId/assessments/initialize')
  @RequirePermission(PERMISSIONS.ASSESSMENT_UPDATE)
  initializeAssessments(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
  ) {
    return this.assessmentsService.initializeForSubmission(projectProgramId, submissionId);
  }

  @Get(':submissionId/assessments/:assessmentId')
  @RequirePermission(PERMISSIONS.ASSESSMENT_READ)
  findAssessment(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.assessmentsService.findById(projectProgramId, submissionId, assessmentId);
  }

  @Post(':submissionId/assessments/:assessmentId/override')
  @RequirePermission(PERMISSIONS.ASSESSMENT_UPDATE)
  overrideAssessment(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Param('assessmentId') assessmentId: string,
    @Body() dto: OverrideAssessmentDto,
  ) {
    return this.assessmentsService.override(
      projectProgramId,
      submissionId,
      assessmentId,
      dto,
    );
  }

  @Delete(':submissionId/assessments/:assessmentId/override')
  @RequirePermission(PERMISSIONS.ASSESSMENT_UPDATE)
  clearOverride(
    @Param('projectProgramId') projectProgramId: string,
    @Param('submissionId') submissionId: string,
    @Param('assessmentId') assessmentId: string,
  ) {
    return this.assessmentsService.clearOverride(
      projectProgramId,
      submissionId,
      assessmentId,
    );
  }
}
