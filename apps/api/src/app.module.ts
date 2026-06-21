import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ProjectsModule } from './projects/projects.module';
import { PersonsModule } from './persons/persons.module';
import { ParticipantsModule } from './participants/participants.module';
import { LocationsModule } from './locations/locations.module';
import { DocumentsModule } from './documents/documents.module';
import { BudgetTemplatesModule } from './budget-templates/budget-templates.module';
import { BudgetsModule } from './budgets/budgets.module';
import { FinancePlansModule } from './finance-plans/finance-plans.module';
import { VendorsModule } from './vendors/vendors.module';
import { ActivityDaysModule } from './activity-days/activity-days.module';
import { ActivityPlansModule } from './activity-plans/activity-plans.module';
import { OwnershipsModule } from './ownerships/ownerships.module';
import { ExpenseFactsModule } from './expense-facts/expense-facts.module';
import { ProgramsModule } from './programs/programs.module';
import { ProjectProgramsModule } from './project-programs/project-programs.module';
import { ProgramApplicationsModule } from './program-applications/program-applications.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { CalculatorsModule } from './calculators/calculators.module';
import { GrantsModule } from './grants/grants.module';
import { IncentiveStrategyModule } from './incentive-strategy/incentive-strategy.module';
import { ReferenceModule } from './reference/reference.module';
import { DerivedRolesModule } from './derived-roles/derived-roles.module';
import { DocumentGenerationModule } from './document-generation/document-generation.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { HealthController } from './common/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { appConfig, dbConfig, jwtConfig, storageConfig } from './config/app.config';
import { ProgramConfigValidationService } from './program-config-validation.service';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, storageConfig],
      envFilePath: ['../../.env', '.env.local', '.env'],
    }),
    PrismaModule,
    TenantModule,
    AuthModule,
    OrganizationsModule,
    InvitationsModule,
    ProjectsModule,
    PersonsModule,
    ParticipantsModule,
    LocationsModule,
    DocumentsModule,
    BudgetTemplatesModule,
    BudgetsModule,
    FinancePlansModule,
    VendorsModule,
    ActivityDaysModule,
    ActivityPlansModule,
    OwnershipsModule,
    ExpenseFactsModule,
    ProgramsModule,
    ProjectProgramsModule,
    ProgramApplicationsModule,
    SubmissionsModule,
    CalculatorsModule,
    GrantsModule,
    IncentiveStrategyModule,
    ReferenceModule,
    DerivedRolesModule,
    DocumentGenerationModule,
  ],
  providers: [
    ProgramConfigValidationService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
