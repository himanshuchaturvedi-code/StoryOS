import { PrismaClient } from '@storyos/database/src/generated/prisma';

const prisma = new PrismaClient();

async function validateRoleMappings() {
  console.log('Validating BudgetAccountRoleMapping integrity...');
  let errors = 0;

  // 1. Every BudgetAccountRoleMapping.programCode maps to a known Program code
  const mappings = await prisma.budgetAccountRoleMapping.findMany({
    include: { account: true },
  });

  const programs = await prisma.program.findMany({ select: { code: true } });
  const programCodes = new Set(programs.map((p) => p.code));

  const roleTypes = await prisma.participantRoleType.findMany({ select: { code: true } });
  const roleTypeCodes = new Set(roleTypes.map((r) => r.code));
  
  // Also add CPTC specific roles if they are not in ParticipantRoleType
  const cptcRoles = new Set([
    'DIRECTOR',
    'SCREENWRITER',
    'LEAD_PERFORMER_1',
    'LEAD_PERFORMER_2',
    'DIRECTOR_OF_PHOTOGRAPHY',
    'ART_DIRECTOR',
    'MUSIC_COMPOSER',
    'PICTURE_EDITOR',
  ]);

  const uniqueMappings = new Set<string>();

  for (const m of mappings) {
    // 1. Program Code
    if (!programCodes.has(m.programCode)) {
      console.error(`[Error] Mapping ${m.id}: Unknown programCode '${m.programCode}'`);
      errors++;
    }

    // 2. Role Code
    if (!roleTypeCodes.has(m.roleCode) && !cptcRoles.has(m.roleCode)) {
      console.error(`[Error] Mapping ${m.id}: Unknown roleCode '${m.roleCode}'`);
      errors++;
    }

    // 3. Duplicate mappings (should be caught by DB constraint, but checking anyway)
    const key = `${m.budgetAccountId}-${m.programCode}-${m.roleCode}`;
    if (uniqueMappings.has(key)) {
      console.error(`[Error] Mapping ${m.id}: Duplicate mapping found for ${key}`);
      errors++;
    }
    uniqueMappings.add(key);

    // 4. Mapped account exists and is not deleted
    if (!m.account || m.account.deletedAt !== null) {
      console.error(`[Error] Mapping ${m.id}: Account ${m.budgetAccountId} is deleted or missing`);
      errors++;
    }
  }

  if (errors === 0) {
    console.log('✅ All role mappings are valid.');
  } else {
    console.error(`❌ Found ${errors} validation errors.`);
    process.exit(1);
  }
}

validateRoleMappings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
