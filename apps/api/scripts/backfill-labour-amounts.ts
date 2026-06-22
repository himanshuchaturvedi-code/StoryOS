import { PrismaClient } from '@storyos/database';
import {
  resolveBackfillTarget,
  summarizeBackfillTargets,
  type BackfillLineInput,
} from '../src/budgets/labour-amount-sync';

const prisma = new PrismaClient();

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  return { dryRun };
}

function mapLine(line: {
  id: string;
  amount: { toString(): string };
  labourAmount: { toString(): string } | null;
  expenseType: string | null;
  account: { accountType: string | null };
}): BackfillLineInput & { lineKey: string } {
  return {
    lineKey: line.id,
    expenseType: line.expenseType,
    accountType: line.account.accountType,
    amount: Number(line.amount),
    currentLabourAmount: line.labourAmount != null ? Number(line.labourAmount) : null,
  };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(`Starting labourAmount backfill${dryRun ? ' (dry-run)' : ''}...`);

  const lines = await prisma.budgetLine.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      amount: true,
      labourAmount: true,
      expenseType: true,
      account: {
        select: { accountType: true },
      },
    },
  });

  const mapped = lines.map(mapLine);
  const beforeSummary = summarizeBackfillTargets(mapped);
  const targets = mapped
    .map((line) => resolveBackfillTarget(line.lineKey, line))
    .filter((target): target is NonNullable<typeof target> => target != null);

  console.log('Before:');
  console.log(JSON.stringify(beforeSummary, null, 2));
  console.log(`Rows needing update: ${targets.length}`);

  if (dryRun) {
    console.log('Dry-run complete. No rows updated.');
    return;
  }

  let updated = 0;
  for (const target of targets) {
    await prisma.budgetLine.update({
      where: { id: target.lineKey },
      data: { labourAmount: target.targetLabourAmount },
    });
    updated++;
  }

  const afterLines = await prisma.budgetLine.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      amount: true,
      labourAmount: true,
      expenseType: true,
      account: {
        select: { accountType: true },
      },
    },
  });

  const afterSummary = summarizeBackfillTargets(afterLines.map(mapLine));

  console.log('After:');
  console.log(JSON.stringify(afterSummary, null, 2));
  console.log(`Updated rows: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
