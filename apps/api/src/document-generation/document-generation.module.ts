import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { DocumentGenerationController } from './document-generation.controller';
import { DocumentGenerationService } from './document-generation.service';
import { CptcPartACollector } from './cptc-part-a.collector';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [DocumentGenerationController],
  providers: [DocumentGenerationService, CptcPartACollector],
})
export class DocumentGenerationModule {}
