/**
 * Import Telefilm documentary budget template into BudgetTemplate / BudgetTemplateAccount.
 *
 * Run: npx ts-node scripts/import-telefilm-template.ts
 *
 * Requires: npm install, .env with DATABASE_URL, and at least one organization.
 */

import * as path from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { PrismaClient } from '@storyos/database';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

const SHEET_NAME = 'TFC Prod. Budget - DETAIL';
const EXCEL_PATH = path.resolve(process.cwd(), 'templates/standard-budget-template-documentary.xlsx');

interface ParsedAccount {
  code: string;
  name: string;
  isHeader: boolean;
  parentCode: string | null;
  sortOrder: number;
}

function normalizeCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}

function parseExcel(): ParsedAccount[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  const accounts: ParsedAccount[] = [];
  const sectionNames = new Map<number, string>();

  // First pass: collect section headers (e.g. row [1, "STORY RIGHTS/ACQUISITIONS"])
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const col0 = row[0];
    const col1 = row[1];

    if (typeof col0 === 'number' && Number.isInteger(col0) && col0 >= 1 && col0 <= 99) {
      if (typeof col1 === 'string') {
        const name = col1.trim();
        if (!name.toUpperCase().startsWith('TOTAL')) {
          sectionNames.set(col0, name);
        }
      }
    }
  }

  // Second pass: collect account rows
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rawAccount = row[0];
    const rawDescription = row[1];

    if (typeof rawAccount !== 'string' || typeof rawDescription !== 'string') continue;

    const code = normalizeCode(rawAccount);
    const name = rawDescription.trim();

    // Skip TOTAL rows
    if (name.toUpperCase().startsWith('TOTAL')) continue;

    // Must match XX.XX pattern (two digits, dot, two digits)
    if (!/^\d{2}\.\d{2}$/.test(code)) continue;

    const isHeader = code.endsWith('.00');
    const parentCode = isHeader ? null : code.substring(0, 2) + '.00';

    accounts.push({
      code,
      name,
      isHeader,
      parentCode,
      sortOrder: i,
    });
  }

  // Insert header accounts for sections that don't have an explicit XX.00 row
  const existingCodes = new Set(accounts.map((a) => a.code));
  for (const [sectionNum, sectionName] of sectionNames) {
    const headerCode = String(sectionNum).padStart(2, '0') + '.00';
    if (!existingCodes.has(headerCode)) {
      const insertIndex = accounts.findIndex(
        (a) => !a.isHeader && a.code.startsWith(String(sectionNum).padStart(2, '0'))
      );
      accounts.splice(insertIndex >= 0 ? insertIndex : accounts.length, 0, {
        code: headerCode,
        name: sectionName,
        isHeader: true,
        parentCode: null,
        sortOrder: insertIndex >= 0 ? insertIndex : accounts.length,
      });
      existingCodes.add(headerCode);
    }
  }

  // Deduplicate by code (keep first occurrence by original row order)
  const seen = new Set<string>();
  const deduped = accounts.filter((a) => {
    if (seen.has(a.code)) return false;
    seen.add(a.code);
    return true;
  });

  // Sort by code (01.00, 01.01, 01.95, 02.00, 02.01, ...) and assign sortOrder
  deduped.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  deduped.forEach((a, i) => {
    a.sortOrder = i;
  });

  return deduped;
}

async function main() {
  console.log('Reading Excel:', EXCEL_PATH);
  const accounts = parseExcel();
  console.log(`Parsed ${accounts.length} accounts`);

  // Get first organization (schema requires organizationId)
  const org = await prisma.organization.findFirst({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  if (!org) {
    throw new Error('No organization found. Run db:seed first.');
  }
  console.log('Using organization:', org.name);

  // Create or get template
  let template = await prisma.budgetTemplate.findFirst({
    where: { name: 'Telefilm Documentary Budget', deletedAt: null },
  });
  if (!template) {
    template = await prisma.budgetTemplate.create({
      data: {
        name: 'Telefilm Documentary Budget',
        description: 'Telefilm standard documentary budget template',
        organizationId: org.id,
      },
    });
  } else {
    await prisma.budgetTemplate.update({
      where: { id: template.id },
      data: {
        description: 'Telefilm standard documentary budget template',
        organizationId: org.id,
      },
    });
  }
  console.log('Template:', template.name);

  // Delete existing accounts for this template (for re-import)
  await prisma.budgetTemplateAccount.deleteMany({
    where: { templateId: template.id },
  });

  // Pass 1: Create all accounts without parentId
  const codeToId = new Map<string, string>();
  for (const acc of accounts) {
    const created = await prisma.budgetTemplateAccount.create({
      data: {
        templateId: template.id,
        code: acc.code,
        name: acc.name,
        isHeader: acc.isHeader,
        sortOrder: acc.sortOrder,
        parentId: null,
      },
    });
    codeToId.set(acc.code, created.id);
  }
  console.log('Pass 1: Created', accounts.length, 'accounts');

  // Pass 2: Resolve parentId
  let updated = 0;
  for (const acc of accounts) {
    if (acc.parentCode) {
      const parentId = codeToId.get(acc.parentCode);
      if (parentId) {
        await prisma.budgetTemplateAccount.update({
          where: { id: codeToId.get(acc.code)! },
          data: { parentId },
        });
        updated++;
      }
    }
  }
  console.log('Pass 2: Updated', updated, 'parent relationships');

  console.log('Done. Template available at Settings → Budget Templates → Telefilm Documentary Budget');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
