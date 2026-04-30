import {
  Controller,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { DocumentGenerationService } from './document-generation.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/documents')
export class DocumentGenerationController {
  constructor(private readonly service: DocumentGenerationService) {}

  @Post('generate/:documentType')
  @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  async generate(
    @Param('projectId') projectId: string,
    @Param('documentType') documentType: string,
    @Query('budgetVersionId') budgetVersionId: string | undefined,
    @Res() res: Response,
  ) {
    if (documentType !== 'CPTC_PART_A') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: `Unsupported document type: ${documentType}. Currently supported: CPTC_PART_A`,
      });
    }

    const result = await this.service.generateCptcPartA(
      projectId,
      budgetVersionId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Content-Length': result.pdfBuffer.length.toString(),
      'X-Document-Id': result.documentId,
      'X-Document-Warnings': JSON.stringify(result.warnings),
    });

    return res.status(HttpStatus.OK).send(result.pdfBuffer);
  }
}
