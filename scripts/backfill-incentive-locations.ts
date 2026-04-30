/**
 * Backfill canonical incentive-region locations for all active organizations.
 *
 * Run:
 *   npx ts-node scripts/backfill-incentive-locations.ts
 *
 * Requires:
 *   - npm install
 *   - .env with DATABASE_URL
 */

import * as path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@storyos/database';
import { INCENTIVE_REGIONS } from '@storyos/types';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  let created = 0;
  let updated = 0;
  for (const org of orgs) {
    for (const region of INCENTIVE_REGIONS) {
      const existing = await prisma.location.findFirst({
        where: {
          organizationId: org.id,
          deletedAt: null,
          name: region.label,
          country: 'CA',
          provinceState: region.provinceState,
          zoneCode: region.zoneCode,
        },
        select: { id: true, incentiveRegionCode: true },
      });

      if (existing) {
        if (!existing.incentiveRegionCode) {
          await prisma.location.update({
            where: { id: existing.id },
            data: { incentiveRegionCode: region.code },
          });
          updated += 1;
        }
        continue;
      }

      await prisma.location.create({
        data: {
          organizationId: org.id,
          createdById: null,
          name: region.label,
          country: 'CA',
          provinceState: region.provinceState,
          zoneCode: region.zoneCode,
          incentiveRegionCode: region.code,
        },
      });
      created += 1;
    }
  }

  console.log(`Backfill complete. Created ${created}, Updated ${updated} canonical incentive-region locations.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
