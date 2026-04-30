/**
 * One-off migration script to rename `zoneCodes` to `regionCodes` in ProgramRequirement.configuration
 *
 * Run:
 *   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2020","esModuleInterop":true}' scripts/migrate-region-codes.ts
 *
 * Dry run (default):
 *   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2020","esModuleInterop":true}' scripts/migrate-region-codes.ts --dry-run
 *
 * Apply changes:
 *   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node","target":"ES2020","esModuleInterop":true}' scripts/migrate-region-codes.ts --apply
 */

import * as path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@storyos/database';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');

  console.log(`Starting ProgramRequirement configuration migration (${isApply ? 'APPLY' : 'DRY RUN'})...`);

  const requirements = await prisma.programRequirement.findMany();

  let migratedCount = 0;

  for (const req of requirements) {
    if (!req.configuration || typeof req.configuration !== 'object') continue;

    const config = req.configuration as Record<string, any>;
    let needsUpdate = false;

    // 1. RegionalSpendConfig (top-level zoneCodes)
    if (req.requirementCategory === 'REGIONAL_SPEND') {
      if (config.zoneCodes !== undefined) {
        config.regionCodes = config.zoneCodes;
        delete config.zoneCodes;
        needsUpdate = true;
      }
    }

    // 2. ActivityDayMinimumConfig (locationFilter.zoneCodes)
    if (req.requirementCategory === 'ACTIVITY_DAY_MINIMUM') {
      if (config.locationFilter && config.locationFilter.zoneCodes !== undefined) {
        config.locationFilter.regionCodes = config.locationFilter.zoneCodes;
        delete config.locationFilter.zoneCodes;
        needsUpdate = true;
      }
    }

    // 3. LabourExpenditureConfig (numeratorLocationFilter.zoneCodes)
    if (req.requirementCategory === 'LABOUR_EXPENDITURE') {
      if (config.numeratorLocationFilter && config.numeratorLocationFilter.zoneCodes !== undefined) {
        config.numeratorLocationFilter.regionCodes = config.numeratorLocationFilter.zoneCodes;
        delete config.numeratorLocationFilter.zoneCodes;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      console.log(`Migrating requirement ${req.id} (${req.code} - ${req.requirementCategory})`);
      if (isApply) {
        await prisma.programRequirement.update({
          where: { id: req.id },
          data: { configuration: config },
        });
      }
      migratedCount++;
    }
  }

  console.log(`Migration complete. ${migratedCount} records ${isApply ? 'updated' : 'would be updated'}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
