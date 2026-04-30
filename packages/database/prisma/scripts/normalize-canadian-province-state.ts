/**
 * One-time data cleanup: Canadian rows with free-text or 2-letter provinces
 * are normalized to ISO 3166-2 (CA-AB, …). Unknown values become NULL.
 *
 * Run: npm run normalize:ca-provinces --workspace=@storyos/database
 */
import { PrismaClient } from '../../src/generated/prisma';
import { normalizeCanadianProvinceState } from '@storyos/types';

const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  let cleared = 0;
  let unchanged = 0;

  const touch = async (
    label: string,
    rows: Array<{ id: string; provinceState: string | null }>,
    update: (id: string, data: { provinceState: string | null }) => Promise<unknown>,
  ) => {
    for (const r of rows) {
      if (!r.provinceState) {
        unchanged++;
        continue;
      }
      const { code, unknown } = normalizeCanadianProvinceState(r.provinceState);
      if (unknown) {
        await update(r.id, { provinceState: null });
        cleared++;
        console.log(`[${label}] ${r.id}: cleared unknown "${r.provinceState}"`);
      } else if (code !== r.provinceState) {
        await update(r.id, { provinceState: code });
        updated++;
        console.log(`[${label}] ${r.id}: "${r.provinceState}" → "${code}"`);
      } else {
        unchanged++;
      }
    }
  };

  const residency = await prisma.participantResidencyStatus.findMany({
    where: { country: 'CA', deletedAt: null },
    select: { id: true, provinceState: true },
  });
  await touch('participant_residency_statuses', residency, (id, data) =>
    prisma.participantResidencyStatus.update({ where: { id }, data }),
  );

  const locations = await prisma.location.findMany({
    where: { country: 'CA', deletedAt: null },
    select: { id: true, provinceState: true },
  });
  await touch('locations', locations, (id, data) =>
    prisma.location.update({ where: { id }, data }),
  );

  const persons = await prisma.person.findMany({
    where: { country: 'CA', deletedAt: null },
    select: { id: true, provinceState: true },
  });
  await touch('persons', persons, (id, data) =>
    prisma.person.update({ where: { id }, data }),
  );

  const vendors = await prisma.vendor.findMany({
    where: { country: 'CA', deletedAt: null },
    select: { id: true, provinceState: true },
  });
  await touch('vendors', vendors, (id, data) =>
    prisma.vendor.update({ where: { id }, data }),
  );

  const orgs = await prisma.organization.findMany({
    where: { country: 'CA', deletedAt: null },
    select: { id: true, provinceState: true },
  });
  await touch('organizations', orgs, (id, data) =>
    prisma.organization.update({ where: { id }, data }),
  );

  console.log(
    JSON.stringify(
      {
        summary: { updatedToCode: updated, clearedUnknown: cleared, unchangedOrEmpty: unchanged },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
