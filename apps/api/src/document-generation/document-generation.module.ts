import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentGenerationController } from './document-generation.controller';
import { DocumentGenerationService } from './document-generation.service';
import { AmpgBudgetCollector } from './ampg-budget.collector';
import { CptcPartACollector } from './cptc-part-a.collector';

@Module({
  imports: [PrismaModule, TenantModule, DocumentsModule],
  controllers: [DocumentGenerationController],
  providers: [DocumentGenerationService, CptcPartACollector, AmpgBudgetCollector],
})
export class DocumentGenerationModule {}
