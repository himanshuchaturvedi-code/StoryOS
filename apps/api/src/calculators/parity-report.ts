import 'reflect-metadata';
import { NestFactory, ContextIdFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from './evaluation.service';
import { TenantContext } from '../tenant/tenant.context';

async function runParityReport() {
  console.log('Bootstrapping StoryOS API for Parity Report...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Fetching all DRAFT/IN_REVIEW submissions...');
  const submissions = await prisma.programSubmission.findMany({
    where: {
      status: { in: ['DRAFT', 'IN_REVIEW'] },
      deletedAt: null,
    },
    include: {
      projectProgram: {
        include: {
          project: true,
          programVersion: { include: { program: true } }
        }
      }
    }
  });

  console.log(`Found ${submissions.length} submissions to evaluate.`);

  const results: Record<string, number> = {
    MATCH: 0,
    MISMATCH: 0,
    SKIPPED_NO_MAPPINGS: 0,
    SCOPE_DIFFERENCE: 0,
    ERRORS: 0,
  };

  const mismatches: any[] = [];

  for (const sub of submissions) {
    const orgId = sub.projectProgram.project.organizationId;
    
    // Resolve request-scoped providers per submission
    const contextId = ContextIdFactory.create();
    const tenantContext = await app.resolve(TenantContext, contextId);
    const evaluationService = await app.resolve(EvaluationService, contextId);

    // Mock TenantContext
    tenantContext.initialize(orgId, 'system-cli', 'OWNER' as any);

    try {
      await evaluationService.evaluateSubmission(
        sub.projectProgram.projectId,
        sub.projectProgramId,
        sub.id
      );
    } catch (err) {
      console.error(`Error evaluating submission ${sub.id}:`, err);
      results['ERRORS'] = (results['ERRORS'] || 0) + 1;
      continue;
    }

    // Fetch the updated assessments
    const assessments = await prisma.requirementAssessment.findMany({
      where: { submissionId: sub.id },
    });

    for (const a of assessments) {
      const cv = a.computedValue as any;
      if (cv && cv.dualPath && cv.dualPath.comparison) {
        const status = cv.dualPath.comparison.status;
        results[status] = (results[status] || 0) + 1;

        if (status === 'MISMATCH') {
          mismatches.push({
            submissionId: sub.id,
            project: sub.projectProgram.project.title,
            program: sub.projectProgram.programVersion.program.code,
            requirementId: a.requirementId,
            calculator: a.calculatorCode,
            comparison: cv.dualPath.comparison,
          });
        }
      }
    }
  }

  console.log('\n=== PARITY REPORT ===');
  console.log(`Total Submissions Evaluated: ${submissions.length}`);
  console.log('Dual-Path Comparison Results:');
  console.log(`  MATCH:               ${results.MATCH}`);
  console.log(`  MISMATCH:            ${results.MISMATCH}`);
  console.log(`  SKIPPED_NO_MAPPINGS: ${results.SKIPPED_NO_MAPPINGS}`);
  console.log(`  SCOPE_DIFFERENCE:    ${results.SCOPE_DIFFERENCE}`);
  console.log(`  ERRORS:              ${results.ERRORS}`);

  if (mismatches.length > 0) {
    console.log('\n--- MISMATCH DETAILS ---');
    mismatches.forEach(m => {
      console.log(`Project: ${m.project} | Program: ${m.program} | Calc: ${m.calculator}`);
      console.log(`Reason: ${m.comparison.reason}`);
      console.log(`Legacy: ${m.comparison.legacyQualifyingCount ?? m.comparison.legacyQualifyingPoints}`);
      console.log(`Derived: ${m.comparison.derivedQualifyingCount ?? m.comparison.derivedQualifyingPoints}`);
      if (m.comparison.roleDiffs) {
        console.log('Role Diffs:', JSON.stringify(m.comparison.roleDiffs, null, 2));
      }
      console.log('------------------------');
    });
  }

  await app.close();
}

runParityReport().catch(err => {
  console.error(err);
  process.exit(1);
});
