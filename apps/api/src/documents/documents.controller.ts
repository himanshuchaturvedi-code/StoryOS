import {
  Controller,
  Get,
  Post,
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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Returns { document, uploadUrl }.
   * Client must PUT the file to uploadUrl with the correct Content-Type.
   * No file bytes pass through the API server.
   */
  @Post('upload')
  @RequirePermission(PERMISSIONS.DOCUMENT_UPLOAD)
  initiateUpload(@Body() dto: CreateDocumentDto) {
    return this.documentsService.initiateUpload(dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.DOCUMENT_READ)
  list(@Query('projectId') projectId?: string) {
    return this.documentsService.list(projectId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.DOCUMENT_READ)
  findOne(@Param('id') id: string) {
    return this.documentsService.findById(id);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.DOCUMENT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
