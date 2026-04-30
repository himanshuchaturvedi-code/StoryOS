import { PrismaClient } from '@storyos/database';
import { BudgetRoleDerivationService } from './budget-role-derivation.service.js';

const prisma = new PrismaClient();
const service = new BudgetRoleDerivationService();

async function runSmokeTest() {
  console.log('Running smoke test for BudgetRoleDerivationService...');

  // 1. Find an organization
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No org found');

  // 2. Create dummy project
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  const project = await prisma.project.create({
    data: {
      title: 'Smoke Test Project',
      organizationId: org.id,
      createdById: user.id,
    }
  });

  // 3. Create budget and version
  const budget = await prisma.budget.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      createdById: user.id,
      baseCurrency: 'CAD',
      name: 'Smoke Test Budget',
    }
  });

  const version = await prisma.budgetVersion.create({
    data: {
      budgetId: budget.id,
      organizationId: org.id,
      createdById: user.id,
      name: 'Smoke Test Version',
      versionNumber: 1,
      status: 'DRAFT',
    }
  });

  // 4. Create dummy persons
  const personA = await prisma.person.create({
    data: { firstName: 'Alice', lastName: 'Winner', organizationId: org.id }
  });
  const personB = await prisma.person.create({
    data: { firstName: 'Bob', lastName: 'Loser', organizationId: org.id }
  });
  const personC = await prisma.person.create({
    data: { firstName: 'Charlie', lastName: 'NoResidency', organizationId: org.id }
  });

  // 5. Create residencies for A and B
  await prisma.participantResidencyStatus.create({
    data: {
      personId: personA.id,
      organizationId: org.id,
      residencyType: 'CITIZEN',
      country: 'CA',
      provinceState: 'CA-ON',
      effectiveFrom: new Date('2020-01-01'),
    }
  });
  await prisma.participantResidencyStatus.create({
    data: {
      personId: personB.id,
      organizationId: org.id,
      residencyType: 'CITIZEN',
      country: 'CA',
      provinceState: 'CA-ON',
      effectiveFrom: new Date('2020-01-01'),
    }
  });

  // 6. Create accounts and mappings
  // Account 1: DIRECTOR
  const acc1 = await prisma.budgetAccount.create({
    data: { budgetId: budget.id, organizationId: org.id, code: '01.01', name: 'Director', accountType: 'ABOVE_THE_LINE' }
  });
  await prisma.budgetAccountRoleMapping.create({
    data: { budgetAccountId: acc1.id, programCode: 'CPTC', roleCode: 'DIRECTOR' }
  });

  // Account 2: WRITER (Non-labour line test)
  const acc2 = await prisma.budgetAccount.create({
    data: { budgetId: budget.id, organizationId: org.id, code: '02.01', name: 'Writer', accountType: 'ABOVE_THE_LINE' }
  });
  await prisma.budgetAccountRoleMapping.create({
    data: { budgetAccountId: acc2.id, programCode: 'CPTC', roleCode: 'SCREENWRITER' }
  });

  // Account 3: EDITOR (Missing person test)
  const acc3 = await prisma.budgetAccount.create({
    data: { budgetId: budget.id, organizationId: org.id, code: '03.01', name: 'Editor', accountType: 'BELOW_THE_LINE_POST' }
  });
  await prisma.budgetAccountRoleMapping.create({
    data: { budgetAccountId: acc3.id, programCode: 'CPTC', roleCode: 'PICTURE_EDITOR' }
  });

  // Account 4: COMPOSER (Vendor without principal person)
  const acc4 = await prisma.budgetAccount.create({
    data: { budgetId: budget.id, organizationId: org.id, code: '04.01', name: 'Composer', accountType: 'BELOW_THE_LINE_POST' }
  });
  await prisma.budgetAccountRoleMapping.create({
    data: { budgetAccountId: acc4.id, programCode: 'CPTC', roleCode: 'MUSIC_COMPOSER' }
  });

  const vendor = await prisma.vendor.create({
    data: { name: 'Music Corp', organizationId: org.id, country: 'CA', vendorType: 'PRODUCTION_SERVICE' }
  });

  // Account 5: ART DIRECTOR (Role with no candidates)
  const acc5 = await prisma.budgetAccount.create({
    data: { budgetId: budget.id, organizationId: org.id, code: '05.01', name: 'Art Director', accountType: 'BELOW_THE_LINE_PRODUCTION' }
  });
  await prisma.budgetAccountRoleMapping.create({
    data: { budgetAccountId: acc5.id, programCode: 'CPTC', roleCode: 'ART_DIRECTOR' }
  });

  // Account 6: DOP (Missing residency test)
  const acc6 = await prisma.budgetAccount.create({
    data: { budgetId: budget.id, organizationId: org.id, code: '06.01', name: 'DOP', accountType: 'BELOW_THE_LINE_PRODUCTION' }
  });
  await prisma.budgetAccountRoleMapping.create({
    data: { budgetAccountId: acc6.id, programCode: 'CPTC', roleCode: 'DIRECTOR_OF_PHOTOGRAPHY' }
  });

  // 7. Create budget lines
  // Two people assigned to same role with equal labour amount (DIRECTOR)
  await prisma.budgetLine.create({
    data: { budgetVersionId: version.id, budgetAccountId: acc1.id, organizationId: org.id, amount: 10000, personId: personA.id, expenseType: 'LABOUR' }
  });
  await prisma.budgetLine.create({
    data: { budgetVersionId: version.id, budgetAccountId: acc1.id, organizationId: org.id, amount: 10000, personId: personB.id, expenseType: 'LABOUR' }
  });

  // One non-labour mapped line (WRITER)
  await prisma.budgetLine.create({
    data: { budgetVersionId: version.id, budgetAccountId: acc2.id, organizationId: org.id, amount: 5000, personId: personA.id, expenseType: 'NON_LABOUR' }
  });

  // One mapped GL with no person (EDITOR)
  await prisma.budgetLine.create({
    data: { budgetVersionId: version.id, budgetAccountId: acc3.id, organizationId: org.id, amount: 8000, expenseType: 'LABOUR' }
  });

  // One vendor without principal person (COMPOSER)
  await prisma.budgetLine.create({
    data: { budgetVersionId: version.id, budgetAccountId: acc4.id, organizationId: org.id, amount: 12000, vendorId: vendor.id, expenseType: 'LABOUR' }
  });

  // One person missing residency (DOP)
  await prisma.budgetLine.create({
    data: { budgetVersionId: version.id, budgetAccountId: acc6.id, organizationId: org.id, amount: 15000, personId: personC.id, expenseType: 'LABOUR' }
  });

  // 8. Run derivation
  const result = await service.derive(prisma as any, {
    budgetVersionId: version.id,
    organizationId: org.id,
    evaluationDate: new Date(),
    programCode: 'CPTC',
  });

  console.log(JSON.stringify(result, null, 2));

  // 9. Assertions
  const director = result.roles.find(r => r.roleCode === 'DIRECTOR');
  if (!director || !director.selectedAssignment) throw new Error('DIRECTOR should have a selected assignment');
  if (director.discardedAssignments.length === 0) throw new Error('DIRECTOR should have discarded assignments');
  console.log('✅ Deterministic tie-breaker works');

  const writer = result.roles.find(r => r.roleCode === 'SCREENWRITER');
  if (!writer || writer.selectedAssignment) throw new Error('SCREENWRITER should not have a selected assignment');
  if (!writer.excludedLines.some(l => l.reason === 'NON_LABOUR_LINE')) throw new Error('SCREENWRITER should have NON_LABOUR_LINE excluded line');
  console.log('✅ Non-labour line excluded');

  const editor = result.roles.find(r => r.roleCode === 'PICTURE_EDITOR');
  if (!editor || !editor.excludedLines.some(l => l.reason === 'MISSING_PERSON')) throw new Error('PICTURE_EDITOR should have MISSING_PERSON excluded line');
  console.log('✅ Missing person excluded');

  const composer = result.roles.find(r => r.roleCode === 'MUSIC_COMPOSER');
  if (!composer || !composer.excludedLines.some(l => l.reason === 'NON_PERSON_PARTY')) throw new Error('MUSIC_COMPOSER should have NON_PERSON_PARTY excluded line');
  console.log('✅ Non-person party excluded');

  const artDirector = result.roles.find(r => r.roleCode === 'ART_DIRECTOR');
  if (!artDirector || artDirector.selectedAssignment) throw new Error('ART_DIRECTOR should be missing');
  if (!result.warnings.some(w => w.code === 'MISSING_ROLE' && w.roleCode === 'ART_DIRECTOR')) throw new Error('ART_DIRECTOR should emit MISSING_ROLE warning');
  console.log('✅ MISSING_ROLE warning emitted');

  const dop = result.roles.find(r => r.roleCode === 'DIRECTOR_OF_PHOTOGRAPHY');
  if (!dop || !dop.selectedAssignment) throw new Error('DIRECTOR_OF_PHOTOGRAPHY should have assignment');
  if (!result.warnings.some(w => w.code === 'MISSING_RESIDENCY' && w.roleCode === 'DIRECTOR_OF_PHOTOGRAPHY')) throw new Error('DIRECTOR_OF_PHOTOGRAPHY should emit MISSING_RESIDENCY warning');
  console.log('✅ MISSING_RESIDENCY warning emitted');

  // 10. Cleanup
  await prisma.budgetLine.deleteMany({ where: { budgetVersionId: version.id } });
  await prisma.budgetAccountRoleMapping.deleteMany({ where: { account: { budgetId: budget.id } } });
  await prisma.budgetAccount.deleteMany({ where: { budgetId: budget.id } });
  await prisma.budgetVersion.delete({ where: { id: version.id } });
  await prisma.budget.delete({ where: { id: budget.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.participantResidencyStatus.deleteMany({ where: { personId: { in: [personA.id, personB.id, personC.id] } } });
  await prisma.person.deleteMany({ where: { id: { in: [personA.id, personB.id, personC.id] } } });
  await prisma.vendor.delete({ where: { id: vendor.id } });

  console.log('Smoke test passed successfully!');
}

runSmokeTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
