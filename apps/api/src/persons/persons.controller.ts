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
import { PersonsService } from './persons.service';
import {
  CreatePersonDto,
  UpdatePersonDto,
  CreateResidencyDto,
  UpdateResidencyDto,
} from './dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PERSON_READ)
  list(@Query('search') search?: string) {
    return this.personsService.list(search);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PERSON_READ)
  findOne(@Param('id') id: string) {
    return this.personsService.findById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PERSON_CREATE)
  create(@Body() dto: CreatePersonDto) {
    return this.personsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PERSON_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.personsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PERSON_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.personsService.remove(id);
  }

  // ── Residency ───────────────────────────────────────────────────────

  @Get(':id/residency')
  @RequirePermission(PERMISSIONS.PERSON_READ)
  listResidency(@Param('id') id: string) {
    return this.personsService.listResidency(id);
  }

  @Post(':id/residency')
  @RequirePermission(PERMISSIONS.PERSON_UPDATE)
  addResidency(@Param('id') id: string, @Body() dto: CreateResidencyDto) {
    return this.personsService.addResidency(id, dto);
  }

  @Patch(':id/residency/:residencyId')
  @RequirePermission(PERMISSIONS.PERSON_UPDATE)
  updateResidency(
    @Param('id') id: string,
    @Param('residencyId') residencyId: string,
    @Body() dto: UpdateResidencyDto,
  ) {
    return this.personsService.updateResidency(id, residencyId, dto);
  }

  @Delete(':id/residency/:residencyId')
  @RequirePermission(PERMISSIONS.PERSON_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteResidency(
    @Param('id') id: string,
    @Param('residencyId') residencyId: string,
  ) {
    return this.personsService.deleteResidency(id, residencyId);
  }

  // ── Audit ───────────────────────────────────────────────────────────

  @Get(':id/audit')
  @RequirePermission(PERMISSIONS.PERSON_READ)
  getAuditLog(@Param('id') id: string) {
    return this.personsService.getAuditLog(id);
  }
}
