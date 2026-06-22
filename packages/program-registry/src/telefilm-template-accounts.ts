import fs from 'fs';
import XLSX from 'xlsx';
import { resolveFromMonorepoRoot } from './paths';

export interface TelefilmTemplateAccount {
  code: string;
  name: string;
  isHeader: boolean;
  section: string;
}

const DEFAULT_SHEET = 'TFC Prod. Budget - DETAIL';

function normalizeTemplateAccountCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}

export function parseTelefilmTemplateAccounts(options?: {
  templatePath?: string;
  sheetName?: string;
}): TelefilmTemplateAccount[] {
  const templatePath =
    options?.templatePath ??
    resolveFromMonorepoRoot('templates/standard-budget-template-documentary.xlsx');
  const sheetName = options?.sheetName ?? DEFAULT_SHEET;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Telefilm template not found at ${templatePath}`);
  }

  const workbook = XLSX.readFile(templatePath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in Telefilm template`);
  }

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  const accounts: TelefilmTemplateAccount[] = [];
  const sectionNames = new Map<number, string>();

  for (const row of data) {
    const sectionNumber = row[0];
    const sectionName = row[1];

    if (
      typeof sectionNumber === 'number' &&
      Number.isInteger(sectionNumber) &&
      sectionNumber >= 1 &&
      sectionNumber <= 99 &&
      typeof sectionName === 'string'
    ) {
      const name = sectionName.trim();
      if (!name.toUpperCase().startsWith('TOTAL')) {
        sectionNames.set(sectionNumber, name);
      }
    }
  }

  for (const row of data) {
    if (!row) continue;
    const rawAccount = row[0];
    const rawDescription = row[1];

    if (typeof rawAccount !== 'string' || typeof rawDescription !== 'string') continue;

    const code = normalizeTemplateAccountCode(rawAccount);
    const name = rawDescription.trim();

    if (name.toUpperCase().startsWith('TOTAL')) continue;
    if (!/^\d{2}\.\d{2}$/.test(code)) continue;

    const section = code.substring(0, 2);
    accounts.push({
      code,
      name,
      isHeader: code.endsWith('.00'),
      section,
    });
  }

  const existingCodes = new Set(accounts.map((account) => account.code));
  for (const [sectionNumber, sectionName] of sectionNames) {
    const sectionPrefix = String(sectionNumber).padStart(2, '0');
    const headerCode = `${sectionPrefix}.00`;
    if (existingCodes.has(headerCode)) continue;

    accounts.push({
      code: headerCode,
      name: sectionName,
      isHeader: true,
      section: sectionPrefix,
    });
    existingCodes.add(headerCode);
  }

  const seen = new Set<string>();
  return accounts
    .filter((account) => {
      if (seen.has(account.code)) return false;
      seen.add(account.code);
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}
