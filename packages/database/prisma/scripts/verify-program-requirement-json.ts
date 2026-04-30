/**
 * One-off / CI helper: confirms ProgramRequirement.configuration is stored as JSON object, not a string.
 * Run: npm run verify:program-requirement-json --workspace=@storyos/database
 */
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<
    { code: string; type: string }[]
  >`
    SELECT code, jsonb_typeof(configuration::jsonb) AS type
    FROM "program_requirements"
    ORDER BY code
  `;
  console.log(JSON.stringify(rows, null, 2));
  const bad = rows.filter((r) => r.type === 'string');
  if (bad.length > 0) {
    console.error('FAIL: configuration is JSON string primitive, not object:', bad);
    process.exit(1);
  }
  if (rows.length === 0) {
    console.warn('No program_requirements rows found — run db:seed first.');
  } else {
    console.log(`OK: all ${rows.length} rows have non-string JSON configuration.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
