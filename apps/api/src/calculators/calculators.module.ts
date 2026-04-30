import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { CalculatorRegistry } from './calculator.registry';
import { EvaluationService } from './evaluation.service';
import { EvaluationController } from './evaluation.controller';
import { EstimatePreviewService } from './estimate-preview.service';
import { EstimatePreviewController } from './estimate-preview.controller';
import { GrantsModule } from '../grants/grants.module';

@Module({
  imports: [PrismaModule, TenantModule, GrantsModule],
  controllers: [EvaluationController, EstimatePreviewController],
  providers: [CalculatorRegistry, EvaluationService, EstimatePreviewService],
  exports: [EvaluationService, EstimatePreviewService, CalculatorRegistry],
})
export class CalculatorsModule {}

