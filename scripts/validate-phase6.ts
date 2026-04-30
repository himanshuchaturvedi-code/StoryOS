import * as path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@storyos/database';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.programRequirement.findMany();
  let badReqs = 0;
  for (const r of reqs) {
    const cfg = JSON.stringify(r.configuration);
    if (cfg && cfg.includes('zoneCode')) {
      console.log(`Found zoneCode in req ${r.id}`);
      badReqs++;
    }
  }
  console.log(`Bad requirements: ${badReqs}`);

  const plans = await prisma.activityPlan.findMany({
    include: { location: true },
    where: { deletedAt: null },
  });
  let badPlans = 0;
  for (const p of plans) {
    if (!p.location.incentiveRegionCode) {
      console.log(`ActivityPlan ${p.id} has location ${p.locationId} with null incentiveRegionCode`);
      badPlans++;
    }
  }
  console.log(`Bad plans: ${badPlans}`);

  const days = await prisma.activityDay.findMany({
    include: { location: true },
    where: { deletedAt: null },
  });
  let badDays = 0;
  for (const d of days) {
    if (!d.location.incentiveRegionCode) {
      console.log(`ActivityDay ${d.id} has location ${d.locationId} with null incentiveRegionCode`);
      badDays++;
    }
  }
  console.log(`Bad days: ${badDays}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
