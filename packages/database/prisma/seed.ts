import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import XLSX from 'xlsx';
import { PrismaClient } from '../src/generated/prisma';
import {
  BudgetAccountType,
  CptcRole,
  ExpenseType,
  PhaseType,
  RoleCategory,
} from '@storyos/types';

const prisma = new PrismaClient();

const DEV_EMAIL = 'dev@storyos.local';
const DEV_PASSWORD = 'password123';
const TELEFILM_TEMPLATE_NAME = 'Telefilm Documentary Budget';
const TELEFILM_TEMPLATE_DESCRIPTION = 'Telefilm standard documentary budget template';
const TELEFILM_TEMPLATE_SHEET = 'TFC Prod. Budget - DETAIL';
const TELEFILM_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../../templates/standard-budget-template-documentary.xlsx',
);

interface ParsedBudgetTemplateAccount {
  code: string;
  name: string;
  accountType: BudgetAccountType | null;
  cptcRole: CptcRole | null;
  defaultPhase: PhaseType | null;
  defaultLabourClassification: ExpenseType | null;
  isHeader: boolean;
  parentCode: string | null;
  sortOrder: number;
}

function classifyTelefilmAccount(code: string, name: string) {
  const section = Number.parseInt(code.split('.')[0] ?? '', 10);
  const upperName = name.toUpperCase();

  if (!Number.isFinite(section)) {
    return {
      accountType: null,
      defaultPhase: null,
      defaultLabourClassification: null,
    };
  }

  const accountType =
    section <= 11
      ? BudgetAccountType.ABOVE_THE_LINE
      : section <= 59
        ? BudgetAccountType.BELOW_THE_LINE_PRODUCTION
        : section <= 69
          ? BudgetAccountType.BELOW_THE_LINE_POST
          : BudgetAccountType.OTHER;

  const defaultPhase =
    section <= 3
      ? PhaseType.DEVELOPMENT
      : section <= 11
        ? PhaseType.PRE_PRODUCTION
        : section <= 51
          ? PhaseType.PRINCIPAL_PHOTOGRAPHY
          : section <= 59
            ? PhaseType.ANIMATION
            : section <= 69
              ? PhaseType.POST_PRODUCTION
              : PhaseType.OTHER;

  const labourSections = new Set([
    2, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
    24, 25, 26, 27, 52, 53, 54, 55, 56, 57, 58, 60, 66,
  ]);

  const labourNameMatch =
    /\b(LABOU?R|CREW|CAST|PERFORMER|EXTRA|PRODUCER|DIRECTOR|WRITER|FRINGE|SALAR|WAGE|FEE|COMPOSER|EDITOR)\b/.test(
      upperName,
    );

  const defaultLabourClassification =
    labourSections.has(section) || labourNameMatch
      ? ExpenseType.LABOUR
      : ExpenseType.NON_LABOUR;

  return {
    accountType,
    defaultPhase,
    defaultLabourClassification,
  };
}

const TELEFILM_CPTC_ROLE_BY_CODE: Record<string, CptcRole> = {
  '02.01': CptcRole.SCREENWRITER,
  '05.01': CptcRole.DIRECTOR,
  '10.20': CptcRole.LEAD_PERFORMER_1,
  '10.25': CptcRole.LEAD_PERFORMER_2,
  '13.10': CptcRole.ART_DIRECTOR,
  '22.01': CptcRole.DIRECTOR_OF_PHOTOGRAPHY,
  '60.10': CptcRole.PICTURE_EDITOR,
  '66.10': CptcRole.MUSIC_COMPOSER,
};

function getTelefilmCptcRole(code: string): CptcRole | null {
  return TELEFILM_CPTC_ROLE_BY_CODE[code] ?? null;
}

/**
 * Participant role types seeded with CAVCO key creative position codes.
 *
 * The `code` field is the canonical identifier used by Phase 5 program calculators.
 * Do NOT change existing codes — they will be referenced by program logic.
 * To add new roles, append to this list with a new unique code.
 *
 * CAVCO point allocation reference (used by Phase 5 CAVCO calculator):
 *   DIRECTOR              → 2 points
 *   SCREENWRITER          → 2 points
 *   LEAD_PERFORMER_1      → 1 point
 *   LEAD_PERFORMER_2      → 1 point
 *   DIRECTOR_OF_PHOTOGRAPHY → 1 point
 *   ART_DIRECTOR          → 1 point
 *   MUSIC_COMPOSER        → 1 point
 *   PICTURE_EDITOR        → 1 point
 *   Maximum: 10 points. Minimum for certification: 6 points.
 */
const participantRoleTypes = [
  // ── CAVCO Key Creative Positions ─────────────────────
  {
    code: 'DIRECTOR',
    name: 'Director',
    category: RoleCategory.KEY_CREATIVE,
    sortOrder: 1,
  },
  {
    code: 'SCREENWRITER',
    name: 'Screenwriter',
    category: RoleCategory.KEY_CREATIVE,
    sortOrder: 2,
  },
  {
    code: 'LEAD_PERFORMER_1',
    name: 'Lead Performer (1)',
    category: RoleCategory.CAST,
    sortOrder: 3,
  },
  {
    code: 'LEAD_PERFORMER_2',
    name: 'Lead Performer (2)',
    category: RoleCategory.CAST,
    sortOrder: 4,
  },
  {
    code: 'DIRECTOR_OF_PHOTOGRAPHY',
    name: 'Director of Photography',
    category: RoleCategory.KEY_CREATIVE,
    sortOrder: 5,
  },
  {
    code: 'ART_DIRECTOR',
    name: 'Art Director',
    category: RoleCategory.KEY_CREATIVE,
    sortOrder: 6,
  },
  {
    code: 'MUSIC_COMPOSER',
    name: 'Music Composer',
    category: RoleCategory.KEY_CREATIVE,
    sortOrder: 7,
  },
  {
    code: 'PICTURE_EDITOR',
    name: 'Picture Editor',
    category: RoleCategory.KEY_CREATIVE,
    sortOrder: 8,
  },
  // ── Above-the-Line ────────────────────────────────────
  {
    code: 'EXECUTIVE_PRODUCER',
    name: 'Executive Producer',
    category: RoleCategory.ABOVE_THE_LINE,
    sortOrder: 10,
  },
  {
    code: 'PRODUCER',
    name: 'Producer',
    category: RoleCategory.ABOVE_THE_LINE,
    sortOrder: 11,
  },
  {
    code: 'CO_PRODUCER',
    name: 'Co-Producer',
    category: RoleCategory.ABOVE_THE_LINE,
    sortOrder: 12,
  },
  // ── Below-the-Line ───────────────────────────────────
  {
    code: 'LINE_PRODUCER',
    name: 'Line Producer',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 20,
  },
  {
    code: 'UNIT_PRODUCTION_MANAGER',
    name: 'Unit Production Manager',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 21,
  },
  {
    code: 'PRODUCTION_DESIGNER',
    name: 'Production Designer',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 22,
  },
  {
    code: 'COSTUME_DESIGNER',
    name: 'Costume Designer',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 23,
  },
  {
    code: 'CASTING_DIRECTOR',
    name: 'Casting Director',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 24,
  },
  {
    code: 'SOUND_MIXER',
    name: 'Production Sound Mixer',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 25,
  },
  {
    code: 'VFX_SUPERVISOR',
    name: 'VFX Supervisor',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 26,
  },
  {
    code: 'ANIMATION_DIRECTOR',
    name: 'Animation Director',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 27,
  },
  {
    code: 'STUNT_COORDINATOR',
    name: 'Stunt Coordinator',
    category: RoleCategory.BELOW_THE_LINE,
    sortOrder: 28,
  },
];

function normalizeTemplateAccountCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}

function parseTelefilmBudgetTemplate(): ParsedBudgetTemplateAccount[] {
  const workbook = XLSX.readFile(TELEFILM_TEMPLATE_PATH);
  const sheet = workbook.Sheets[TELEFILM_TEMPLATE_SHEET];
  if (!sheet) {
    throw new Error(`Sheet "${TELEFILM_TEMPLATE_SHEET}" not found`);
  }

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  const accounts: ParsedBudgetTemplateAccount[] = [];
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

  for (let index = 0; index < data.length; index++) {
    const row = data[index];
    if (!row) continue;
    const rawAccount = row[0];
    const rawDescription = row[1];

    if (typeof rawAccount !== 'string' || typeof rawDescription !== 'string') continue;

    const code = normalizeTemplateAccountCode(rawAccount);
    const name = rawDescription.trim();

    if (name.toUpperCase().startsWith('TOTAL')) continue;
    if (!/^\d{2}\.\d{2}$/.test(code)) continue;

    const isHeader = code.endsWith('.00');
    const classification = classifyTelefilmAccount(code, name);
    accounts.push({
      code,
      name,
      ...classification,
      cptcRole: getTelefilmCptcRole(code),
      isHeader,
      parentCode: isHeader ? null : `${code.substring(0, 2)}.00`,
      sortOrder: index,
    });
  }

  const existingCodes = new Set(accounts.map((account) => account.code));
  for (const [sectionNumber, sectionName] of sectionNames) {
    const sectionPrefix = String(sectionNumber).padStart(2, '0');
    const headerCode = `${sectionPrefix}.00`;
    if (existingCodes.has(headerCode)) continue;

    const insertIndex = accounts.findIndex(
      (account) => !account.isHeader && account.code.startsWith(sectionPrefix),
    );
    accounts.splice(insertIndex >= 0 ? insertIndex : accounts.length, 0, {
      code: headerCode,
      name: sectionName,
      ...classifyTelefilmAccount(headerCode, sectionName),
      cptcRole: null,
      isHeader: true,
      parentCode: null,
      sortOrder: insertIndex >= 0 ? insertIndex : accounts.length,
    });
    existingCodes.add(headerCode);
  }

  const seen = new Set<string>();
  const deduped = accounts.filter((account) => {
    if (seen.has(account.code)) return false;
    seen.add(account.code);
    return true;
  });

  deduped.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  deduped.forEach((account, index) => {
    account.sortOrder = index;
  });

  return deduped;
}

async function seedTelefilmBudgetTemplate(organizationId: string, createdById: string) {
  const accounts = parseTelefilmBudgetTemplate();

  if (accounts.length === 0) {
    throw new Error('Telefilm budget template import parsed 0 accounts');
  }

  const existing = await prisma.budgetTemplate.findFirst({
    where: {
      organizationId,
      name: TELEFILM_TEMPLATE_NAME,
      deletedAt: null,
    },
  });

  const template = existing
    ? await prisma.budgetTemplate.update({
        where: { id: existing.id },
        data: {
          description: TELEFILM_TEMPLATE_DESCRIPTION,
          organizationId,
          createdById,
        },
      })
    : await prisma.budgetTemplate.create({
        data: {
          organizationId,
          createdById,
          name: TELEFILM_TEMPLATE_NAME,
          description: TELEFILM_TEMPLATE_DESCRIPTION,
        },
      });

  await prisma.budgetTemplateAccount.deleteMany({
    where: { templateId: template.id },
  });

  const codeToId = new Map<string, string>();
  for (const account of accounts) {
    const created = await prisma.budgetTemplateAccount.create({
      data: {
        templateId: template.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        cptcRole: account.cptcRole,
        defaultPhase: account.defaultPhase,
        defaultLabourClassification: account.defaultLabourClassification,
        isHeader: account.isHeader,
        sortOrder: account.sortOrder,
        parentId: null,
      },
    });
    codeToId.set(account.code, created.id);
  }

  const reparentUpdates = accounts
    .filter((account) => account.parentCode && codeToId.has(account.parentCode))
    .map((account) =>
      prisma.budgetTemplateAccount.update({
        where: { id: codeToId.get(account.code)! },
        data: { parentId: codeToId.get(account.parentCode!)! },
      }),
    );

  if (reparentUpdates.length > 0) {
    await prisma.$transaction(reparentUpdates);
  }

  // Create role mappings for all programs that share the CAVCO key creative positions.
  const ROLE_MAPPING_PROGRAMS = ['CPTC', 'OFTTC', 'CMF'];
  const roleMappingCreates = accounts.flatMap((account) => {
    if (!account.cptcRole) return [];
    const templateAccountId = codeToId.get(account.code);
    if (!templateAccountId) return [];
    return ROLE_MAPPING_PROGRAMS.map((programCode) => ({
      budgetTemplateAccountId: templateAccountId,
      programCode,
      roleCode: account.cptcRole!,
    }));
  });

  if (roleMappingCreates.length > 0) {
    await prisma.budgetTemplateAccountRoleMapping.createMany({
      data: roleMappingCreates,
      skipDuplicates: true,
    });
    console.log(`  Created ${roleMappingCreates.length} template role mappings (${ROLE_MAPPING_PROGRAMS.join(', ')}).`);
  }

  for (const account of accounts) {
    await prisma.budgetAccount.updateMany({
      where: {
        organizationId,
        code: account.code,
        deletedAt: null,
      },
      data: {
        accountType: account.accountType,
        cptcRole: account.cptcRole,
        defaultPhase: account.defaultPhase,
        defaultLabourClassification: account.defaultLabourClassification,
      },
    });
  }

  const classifiedAccounts = accounts.filter((account) => account.accountType).length;
  console.log(
    `Seeded ${TELEFILM_TEMPLATE_NAME} with ${accounts.length} accounts (${classifiedAccounts} classified).`,
  );
}

async function main() {
  console.log('Seeding ParticipantRoleType...');

  for (const roleType of participantRoleTypes) {
    await prisma.participantRoleType.upsert({
      where: { code: roleType.code },
      update: {
        name: roleType.name,
        category: roleType.category as any,
        sortOrder: roleType.sortOrder,
      },
      create: {
        ...roleType,
        category: roleType.category as any,
      },
    });
  }

  console.log(`Seeded ${participantRoleTypes.length} participant role types.`);

  // ── Development seed (org, user, project, budget, program, submission) ───
  const runDevSeed = process.env['SEED_DEV'] !== 'false' && process.env['NODE_ENV'] !== 'production';
  if (runDevSeed) {
    await seedDevData();
  }
}

async function seedDevData() {
  console.log('Seeding development data...');

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: { passwordHash },
    create: {
      email: DEV_EMAIL,
      passwordHash,
      firstName: 'Dev',
      lastName: 'User',
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'storyos-dev' },
    update: {},
    create: {
      name: 'StoryOS Dev',
      slug: 'storyos-dev',
      type: 'PRODUCTION_COMPANY',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: user.id },
    },
    update: { role: 'OWNER' },
    create: {
      organizationId: org.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  await seedTelefilmBudgetTemplate(org.id, user.id);

  const project =
    (await prisma.project.findFirst({
      where: { organizationId: org.id, title: 'Dev Feature Film' },
    })) ??
    (await prisma.project.create({
      data: {
        organizationId: org.id,
        title: 'Dev Feature Film',
        status: 'DRAFT',
        stage: 'DEVELOPMENT',
        createdById: user.id,
      },
    }));

  const budget = await prisma.budget.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      projectId: project.id,
      organizationId: org.id,
      name: 'Production Budget',
      createdById: user.id,
    },
  });

  const budgetAccount = await prisma.budgetAccount.upsert({
    where: {
      budgetId_code: { budgetId: budget.id, code: 'TOTAL' },
    },
    update: {},
    create: {
      budgetId: budget.id,
      organizationId: org.id,
      code: 'TOTAL',
      name: 'Total Budget',
      accountType: 'ABOVE_THE_LINE',
      isHeader: false,
      sortOrder: 0,
    },
  });

  const location =
    (await prisma.location.findFirst({
      where: {
        organizationId: org.id,
        name: 'Calgary Studio',
        country: 'CA',
        provinceState: 'CA-AB',
      },
    })) ??
    (await prisma.location.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        name: 'Calgary Studio',
        country: 'CA',
        provinceState: 'CA-AB',
        city: 'Calgary',
        locationType: 'ON_LOCATION',
        incentiveRegionCode: 'AB-METRO',
      },
    }));

  await prisma.location.update({
    where: { id: location.id },
    data: { incentiveRegionCode: 'AB-METRO' },
  });

  await prisma.projectLocation.upsert({
    where: {
      projectId_locationId: { projectId: project.id, locationId: location.id },
    },
    update: { isPrimary: true },
    create: {
      projectId: project.id,
      organizationId: org.id,
      locationId: location.id,
      isPrimary: true,
    },
  });

  const productionPhase =
    (await prisma.productionPhase.findFirst({
      where: {
        projectId: project.id,
        phaseType: 'PRINCIPAL_PHOTOGRAPHY',
      },
    })) ??
    (await prisma.productionPhase.create({
      data: {
        projectId: project.id,
        organizationId: org.id,
        createdById: user.id,
        phaseType: 'PRINCIPAL_PHOTOGRAPHY',
        name: 'Principal Photography',
      },
    }));

  const budgetVersion = await prisma.budgetVersion.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: { status: 'LOCKED', lockedAt: new Date(), lockedById: user.id },
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      budgetId: budget.id,
      organizationId: org.id,
      versionNumber: 1,
      name: 'v1',
      status: 'LOCKED',
      lockedAt: new Date(),
      lockedById: user.id,
      createdById: user.id,
    },
  });

  await prisma.budgetLine.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {
      amount: 2500000,
      locationId: location.id,
      productionPhaseId: productionPhase.id,
      expenseType: 'LABOUR',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      budgetVersionId: budgetVersion.id,
      budgetAccountId: budgetAccount.id,
      organizationId: org.id,
      locationId: location.id,
      productionPhaseId: productionPhase.id,
      expenseType: 'LABOUR',
      amount: 2500000,
      currency: 'CAD',
    },
  });

  await prisma.activityPlan.upsert({
    where: {
      projectId_locationId_productionPhaseId: {
        projectId: project.id,
        locationId: location.id,
        productionPhaseId: productionPhase.id,
      },
    },
    update: { plannedDays: 20 },
    create: {
      projectId: project.id,
      organizationId: org.id,
      locationId: location.id,
      productionPhaseId: productionPhase.id,
      plannedDays: 20,
    },
  });

  const actualLine = await prisma.actualLine.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: { amount: 1800000 },
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      budgetId: budget.id,
      budgetAccountId: budgetAccount.id,
      organizationId: org.id,
      amount: 1800000,
      currency: 'CAD',
      transactionDate: new Date('2025-01-15'),
      createdById: user.id,
    },
  });

  await prisma.expenseFact.upsert({
    where: { actualLineId: actualLine.id },
    update: { eligiblePortion: 1.0 },
    create: {
      actualLineId: actualLine.id,
      organizationId: org.id,
      projectId: project.id,
      eligiblePortion: 1.0,
      labourFlag: false,
      serviceFlag: false,
      createdById: user.id,
    },
  });

  const program = await prisma.program.upsert({
    where: { code: 'DEV-PROGRAM' },
    update: {},
    create: {
      code: 'DEV-PROGRAM',
      name: 'Dev Tax Credit Program',
      scope: 'FEDERAL',
      country: 'CA',
      administeredBy: 'Dev Agency',
    },
  });

  const programVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: program.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: program.id,
      versionCode: '2025',
      name: '2025 Rules',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const programRequirement = await prisma.programRequirement.upsert({
    where: {
      programVersionId_code: { programVersionId: programVersion.id, code: 'MIN_SPEND' },
    },
    update: {
      configuration: { minAmount: 1000000, currency: 'CAD' },
    },
    create: {
      programVersionId: programVersion.id,
      code: 'MIN_SPEND',
      name: 'Minimum Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { minAmount: 1000000, currency: 'CAD' },
      isRequired: true,
      sortOrder: 0,
    },
  });

  const projectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: programVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: programVersion.id,
      status: 'ACTIVE',
    },
  });

  const programSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-000000000006' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000006',
      projectProgramId: projectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  await prisma.requirementAssessment.upsert({
    where: {
      submissionId_requirementId: {
        submissionId: programSubmission.id,
        requirementId: programRequirement.id,
      },
    },
    update: {},
    create: {
      submissionId: programSubmission.id,
      organizationId: org.id,
      requirementId: programRequirement.id,
      result: 'NOT_EVALUATED',
    },
  });

  // ── CPTC (Canadian Film or Video Production Tax Credit) ─────────────
  const cptcProgram = await prisma.program.upsert({
    where: { code: 'CPTC' },
    update: {},
    create: {
      code: 'CPTC',
      name: 'Canadian Film or Video Production Tax Credit',
      scope: 'FEDERAL',
      country: 'CA',
      administeredBy: 'CAVCO / CRA',
    },
  });

  const cptcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: cptcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: cptcProgram.id,
      versionCode: '2025',
      name: 'CPTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const cptcRequirements = [
    {
      code: 'CPTC_EXPENDITURE',
      name: 'Qualified Canadian Labour Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: true, minAmount: 25000 },
      sortOrder: 1,
    },
    {
      code: 'CPTC_LABOUR_RATIO',
      name: 'Canadian labour ≥ 60% of production cost',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        threshold: 0.6,
        comparison: 'gte',
      },
      sortOrder: 2,
    },
    {
      code: 'CPTC_KEY_CREATIVE',
      name: 'CAVCO Key Creative Personnel (6/10 Points)',
      requirementCategory: 'KEY_CREATIVE_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        positions: [
          { roleCode: 'DIRECTOR', points: 2 },
          { roleCode: 'SCREENWRITER', points: 2 },
          { roleCode: 'LEAD_PERFORMER_1', points: 1 },
          { roleCode: 'LEAD_PERFORMER_2', points: 1 },
          { roleCode: 'DIRECTOR_OF_PHOTOGRAPHY', points: 1 },
          { roleCode: 'ART_DIRECTOR', points: 1 },
          { roleCode: 'MUSIC_COMPOSER', points: 1 },
          { roleCode: 'PICTURE_EDITOR', points: 1 },
        ],
        minPoints: 6,
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
      },
      sortOrder: 3,
    },
    {
      code: 'CPTC_CANADIAN_CONTROL',
      name: 'Canadian Ownership & Control',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 51,
        qualifyingCountries: ['CA'],
        requireCreativeControl: true,
        requireFinancialControl: true,
      },
      sortOrder: 4,
    },
    {
      code: 'CPTC_RIGHTS',
      name: 'Copyright & Distribution Rights',
      requirementCategory: 'RIGHTS_CONTROL',
      primaryFactSource: 'RIGHTS_CONTROL_FACT',
      configuration: {
        requiredControlTypes: ['COPYRIGHT_OWNERSHIP', 'DISTRIBUTION_RIGHTS'],
        qualifyingCountries: ['CA'],
      },
      sortOrder: 5,
    },
    {
      code: 'CPTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
          'WEB_SERIES', 'SHORT_FILM',
        ],
        minRuntimeMinutes: 75,
      },
      sortOrder: 6,
    },
  ];

  for (const req of cptcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: cptcVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: cptcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const cptcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: cptcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: cptcVersion.id,
      status: 'ACTIVE',
    },
  });

  const cptcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000001',
      projectProgramId: cptcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const cptcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: cptcVersion.id },
  });
  for (const req of cptcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: cptcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: cptcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  CPTC: ${cptcReqs.length} requirements, submission ${cptcSubmission.id}`);

  // ── PSTC (Film or Video Production Services Tax Credit) ─────────────
  // Federal services credit: no Canadian control, key creative, or rights tests.
  const pstcProgram = await prisma.program.upsert({
    where: { code: 'PSTC' },
    update: {},
    create: {
      code: 'PSTC',
      name: 'Film or Video Production Services Tax Credit',
      scope: 'FEDERAL',
      country: 'CA',
      administeredBy: 'CAVCO / CRA',
    },
  });

  const pstcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: pstcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: pstcProgram.id,
      versionCode: '2025',
      name: 'PSTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const pstcRequirements = [
    {
      code: 'PSTC_EXPENDITURE',
      name: 'Qualified Canadian Labour Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: true, minAmount: 25000 },
      sortOrder: 1,
    },
    {
      code: 'PSTC_LABOUR',
      name: 'Canadian Resident Labour Share',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        threshold: 0.75,
        comparison: 'gte',
      },
      sortOrder: 2,
    },
    {
      code: 'PSTC_RESIDENCY',
      name: 'Prescribed Labour — Canadian Residency',
      requirementCategory: 'RESIDENCY_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        scope: 'all_participants',
        comparison: 'gte',
      },
      sortOrder: 3,
    },
    {
      code: 'PSTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
          'WEB_SERIES', 'SHORT_FILM',
        ],
        minRuntimeMinutes: 75,
      },
      sortOrder: 4,
    },
  ];

  for (const req of pstcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: pstcVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: pstcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const pstcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: pstcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: pstcVersion.id,
      status: 'ACTIVE',
    },
  });

  const pstcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000004',
      projectProgramId: pstcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const pstcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: pstcVersion.id },
  });
  for (const req of pstcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: pstcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: pstcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  PSTC: ${pstcReqs.length} requirements, submission ${pstcSubmission.id}`);

  // ── OFTTC (Ontario Film and Television Tax Credit) ──────────────────
  const ofttcProgram = await prisma.program.upsert({
    where: { code: 'OFTTC' },
    update: {},
    create: {
      code: 'OFTTC',
      name: 'Ontario Film and Television Tax Credit',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'ON',
      administeredBy: 'Ontario Creates',
    },
  });

  const ofttcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: ofttcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: ofttcProgram.id,
      versionCode: '2025',
      name: 'OFTTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const ofttcRequirements = [
    {
      code: 'OFTTC_EXPENDITURE',
      name: 'Ontario Eligible Labour Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: true },
      sortOrder: 1,
    },
    {
      code: 'OFTTC_LABOUR',
      name: 'Ontario Resident Labour Ratio',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        threshold: 0.75,
        comparison: 'gte',
      },
      sortOrder: 2,
    },
    {
      code: 'OFTTC_REGIONAL',
      name: 'Regional Spend (Outside GTA)',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['ON-NORTHERN', 'ON-EASTERN', 'ON-SOUTHWESTERN'],
        minDayPercentage: 0.85,
        bonusRate: 0.10,
      },
      sortOrder: 3,
    },
    {
      code: 'OFTTC_DISTANT',
      name: 'Distant Location (Northern Ontario / Outside Entire GTA)',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['ON-NORTHERN'],
        minDayPercentage: 0.85,
        bonusRate: 0.10,
      },
      sortOrder: 3,
    },
    {
      code: 'OFTTC_KEY_CREATIVE',
      name: 'CAVCO Key Creative Personnel (6/10 Points)',
      requirementCategory: 'KEY_CREATIVE_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        positions: [
          { roleCode: 'DIRECTOR', points: 2 },
          { roleCode: 'SCREENWRITER', points: 2 },
          { roleCode: 'LEAD_PERFORMER_1', points: 1 },
          { roleCode: 'LEAD_PERFORMER_2', points: 1 },
          { roleCode: 'DIRECTOR_OF_PHOTOGRAPHY', points: 1 },
          { roleCode: 'ART_DIRECTOR', points: 1 },
          { roleCode: 'MUSIC_COMPOSER', points: 1 },
          { roleCode: 'PICTURE_EDITOR', points: 1 },
        ],
        minPoints: 6,
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
      },
      sortOrder: 4,
    },
    {
      code: 'OFTTC_CANADIAN_CONTROL',
      name: 'Canadian Ownership & Control',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 51,
        qualifyingCountries: ['CA'],
        requireCreativeControl: true,
        requireFinancialControl: true,
      },
      sortOrder: 5,
    },
    {
      code: 'OFTTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 6,
    },
  ];

  for (const req of ofttcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: ofttcVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: ofttcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const ofttcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: ofttcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: ofttcVersion.id,
      status: 'ACTIVE',
    },
  });

  const ofttcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000002',
      projectProgramId: ofttcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const ofttcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: ofttcVersion.id },
  });
  for (const req of ofttcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: ofttcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: ofttcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  OFTTC: ${ofttcReqs.length} requirements, submission ${ofttcSubmission.id}`);

  // ── OPSTC (Ontario Production Services Tax Credit) ───────────────
  const opstcProgram = await prisma.program.upsert({
    where: { code: 'OPSTC' },
    update: {},
    create: {
      code: 'OPSTC',
      name: 'Ontario Production Services Tax Credit',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'ON',
      administeredBy: 'Ontario Creates',
    },
  });

  const opstcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: opstcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: opstcProgram.id,
      versionCode: '2025',
      name: 'OPSTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const opstcRequirements = [
    {
      code: 'OPSTC_EXPENDITURE',
      name: 'Qualifying Ontario Production Expenditures (QPE)',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, serviceOnly: false },
      sortOrder: 1,
    },
    {
      code: 'OPSTC_ONTARIO_LABOUR_QPE',
      name: 'Ontario Labour as Share of QPE (≥25%; cap 4× labour)',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorMode: 'location',
        numeratorLocationFilter: { country: 'CA', provinceState: 'CA-ON' },
        threshold: 0.25,
        comparison: 'gte',
        denominatorMode: 'qpe',
      },
      sortOrder: 2,
    },
    {
      code: 'OPSTC_RESIDENCY',
      name: 'Prescribed Labour — Canadian Residency',
      requirementCategory: 'RESIDENCY_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        scope: 'all_participants',
        comparison: 'gte',
      },
      sortOrder: 3,
    },
    {
      code: 'OPSTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 4,
    },
  ];

  for (const req of opstcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: opstcVersion.id, code: req.code },
      },
      update: {
        configuration: req.configuration,
        sortOrder: req.sortOrder,
        name: req.name,
      },
      create: {
        programVersionId: opstcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const opstcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: opstcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: opstcVersion.id,
      status: 'ACTIVE',
    },
  });

  const opstcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000006' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000006',
      projectProgramId: opstcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const opstcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: opstcVersion.id },
  });
  for (const req of opstcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: opstcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: opstcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  OPSTC: ${opstcReqs.length} requirements, submission ${opstcSubmission.id}`);

  // ── OCASE (Ontario Computer Animation and Special Effects Tax Credit)
  const ocaseProgram = await prisma.program.upsert({
    where: { code: 'OCASE' },
    update: {},
    create: {
      code: 'OCASE',
      name: 'Ontario Computer Animation and Special Effects Tax Credit',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'ON',
      administeredBy: 'Ontario Creates',
    },
  });

  const ocaseVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: ocaseProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: ocaseProgram.id,
      versionCode: '2025',
      name: 'OCASE 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const ocaseRequirements = [
    {
      code: 'OCASE_EXPENDITURE',
      name: 'Minimum Ontario Eligible Animation / VFX Labour',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: true, minAmount: 25000 },
      sortOrder: 1,
    },
    {
      code: 'OCASE_LABOUR',
      name: 'Ontario Resident Labour Ratio',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        threshold: 0.75,
        comparison: 'gte',
      },
      sortOrder: 2,
    },
    {
      code: 'OCASE_DOCUMENTATION',
      name: 'Ontario Creates VFX / Animation Eligible Activity Certification',
      requirementCategory: 'DOCUMENTATION',
      primaryFactSource: 'DOCUMENT',
      configuration: {
        requiredCategories: ['VFX_ACTIVITY_REPORT', 'ELIGIBILITY_CERTIFICATE'],
        optionalCategories: ['TAX_CLAIM_FORM'],
      },
      sortOrder: 3,
    },
    {
      code: 'OCASE_CANADIAN_CONTROL',
      name: 'Canadian Ownership & Control',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 51,
        qualifyingCountries: ['CA'],
        requireCreativeControl: true,
        requireFinancialControl: true,
      },
      sortOrder: 4,
    },
    {
      code: 'OCASE_FORMAT',
      name: 'Eligible Production Format (Animation / VFX)',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'ANIMATION_FEATURE',
          'ANIMATION_SERIES',
          'FEATURE_FILM',
          'TV_SERIES',
          'TV_MOVIE',
          'DOCUMENTARY_FEATURE',
          'DOCUMENTARY_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 5,
    },
  ];

  for (const req of ocaseRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: ocaseVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: ocaseVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const ocaseProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: ocaseVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: ocaseVersion.id,
      status: 'ACTIVE',
    },
  });

  const ocaseSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000005',
      projectProgramId: ocaseProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const ocaseReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: ocaseVersion.id },
  });
  for (const req of ocaseReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: ocaseSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: ocaseSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  OCASE: ${ocaseReqs.length} requirements, submission ${ocaseSubmission.id}`);

  // ── FIBC (British Columbia Film Incentive) ──────────────────────────
  const fibcProgram = await prisma.program.upsert({
    where: { code: 'FIBC' },
    update: {},
    create: {
      code: 'FIBC',
      name: 'British Columbia Film Incentive',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'BC',
      administeredBy: 'Creative BC',
    },
  });

  const fibcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: fibcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: fibcProgram.id,
      versionCode: '2025',
      name: 'FIBC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const fibcRequirements = [
    {
      code: 'FIBC_EXPENDITURE',
      name: 'BC Eligible Labour Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: true },
      sortOrder: 1,
    },
    {
      code: 'FIBC_LABOUR',
      name: 'BC Resident Labour Ratio',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        threshold: 0.75,
        comparison: 'gte',
      },
      sortOrder: 2,
    },
    {
      code: 'FIBC_REGIONAL',
      name: 'Regional Spend (BC Regional Zone)',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['BC-REGIONAL'],
        minDayPercentage: 0.5,
      },
      sortOrder: 3,
    },
    {
      code: 'FIBC_DISTANT',
      name: 'Distant Location (BC Distant Zone)',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['BC-DISTANT'],
        minDayPercentage: 0.5,
        bonusRate: 0.06,
      },
      sortOrder: 3,
    },
    {
      code: 'FIBC_ACTIVITY_DAYS',
      name: 'Minimum Shoot Days in British Columbia',
      requirementCategory: 'ACTIVITY_DAY_MINIMUM',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        minDays: 5,
        locationFilter: { country: 'CA', provinceState: 'CA-BC' },
      },
      sortOrder: 4,
    },
    {
      code: 'FIBC_CANADIAN_CONTROL',
      name: 'Canadian Ownership & Creative Control',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 51,
        qualifyingCountries: ['CA'],
        requireCreativeControl: true,
        requireFinancialControl: false,
      },
      sortOrder: 5,
    },
    {
      code: 'FIBC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
          'SHORT_FILM',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 6,
    },
    {
      code: 'FIBC_VENDOR',
      name: 'Vendor Program Eligibility',
      requirementCategory: 'VENDOR_ELIGIBILITY',
      primaryFactSource: 'VENDOR_ELIGIBILITY',
      configuration: { programCode: 'FIBC', requiredStatus: 'ELIGIBLE' },
      sortOrder: 7,
    },
  ];

  for (const req of fibcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: fibcVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: fibcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const fibcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: fibcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: fibcVersion.id,
      status: 'ACTIVE',
    },
  });

  const fibcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000003',
      projectProgramId: fibcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const fibcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: fibcVersion.id },
  });
  for (const req of fibcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: fibcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: fibcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  FIBC: ${fibcReqs.length} requirements, submission ${fibcSubmission.id}`);

  // ── BC PSTC (British Columbia Production Services Tax Credit) ──────
  // Provincial services credit: no Canadian control or key creative tests.
  // Uses location-mode labour (CA-BC) and QPE-style expenditure.
  const bcpstcProgram = await prisma.program.upsert({
    where: { code: 'BC-PSTC' },
    update: {},
    create: {
      code: 'BC-PSTC',
      name: 'British Columbia Production Services Tax Credit',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'BC',
      administeredBy: 'Creative BC',
    },
  });

  const bcpstcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: bcpstcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: bcpstcProgram.id,
      versionCode: '2025',
      name: 'BC-PSTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const bcpstcRequirements = [
    {
      code: 'BCPSTC_EXPENDITURE',
      name: 'Qualified BC Production Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, serviceOnly: false },
      sortOrder: 1,
    },
    {
      code: 'BCPSTC_LABOUR',
      name: 'BC Labour as Share of Qualified Expenditure (≥25%)',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorMode: 'location',
        numeratorLocationFilter: { country: 'CA', provinceState: 'CA-BC' },
        threshold: 0.25,
        comparison: 'gte',
        denominatorMode: 'qpe',
      },
      sortOrder: 2,
    },
    {
      code: 'BCPSTC_RESIDENCY',
      name: 'Prescribed Labour — Canadian Residency',
      requirementCategory: 'RESIDENCY_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        scope: 'all_participants',
        comparison: 'gte',
      },
      sortOrder: 3,
    },
    {
      code: 'BCPSTC_REGIONAL',
      name: 'Distant Location Regional Bonus',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['BC-REGIONAL'],
        minDayPercentage: 0.5,
        bonusRate: 0.06,
      },
      sortOrder: 4,
    },
    {
      code: 'BCPSTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 5,
    },
  ];

  for (const req of bcpstcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: bcpstcVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: bcpstcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const bcpstcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: bcpstcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: bcpstcVersion.id,
      status: 'ACTIVE',
    },
  });

  const bcpstcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000007' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000007',
      projectProgramId: bcpstcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const bcpstcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: bcpstcVersion.id },
  });
  for (const req of bcpstcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: bcpstcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: bcpstcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  BC-PSTC: ${bcpstcReqs.length} requirements, submission ${bcpstcSubmission.id}`);

  // ── CMF (Canada Media Fund) ────────────────────────────────────────
  // Federal grant (not a tax credit). Validates non-tax-credit program shape.
  // Heavy on documentation (broadcaster commitment, distribution agreement).
  // TODO: CMF has genre-based eligibility rules (drama, documentary, children's,
  // variety, performing arts). FORMAT_ELIGIBILITY does not yet support genre
  // filtering. When genre support is added, update CMF_FORMAT configuration
  // with allowedGenres.
  const cmfProgram = await prisma.program.upsert({
    where: { code: 'CMF' },
    update: {},
    create: {
      code: 'CMF',
      name: 'Canada Media Fund',
      scope: 'FEDERAL',
      country: 'CA',
      administeredBy: 'Canada Media Fund',
    },
  });

  const cmfVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: cmfProgram.id, versionCode: '2025-2026' },
    },
    update: {},
    create: {
      programId: cmfProgram.id,
      versionCode: '2025-2026',
      name: 'CMF 2025–2026',
      effectiveFrom: new Date('2025-04-01'),
      effectiveTo: new Date('2026-03-31'),
    },
  });

  const cmfRequirements = [
    {
      code: 'CMF_EXPENDITURE',
      name: 'Minimum Production Budget',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, minAmount: 100000 },
      sortOrder: 1,
    },
    {
      code: 'CMF_CANADIAN_CONTROL',
      name: 'Canadian Ownership & Control',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 51,
        qualifyingCountries: ['CA'],
        requireCreativeControl: true,
        requireFinancialControl: true,
      },
      sortOrder: 2,
    },
    {
      code: 'CMF_KEY_CREATIVE',
      name: 'CAVCO Key Creative Personnel (6/10 Points)',
      requirementCategory: 'KEY_CREATIVE_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        positions: [
          { roleCode: 'DIRECTOR', points: 2 },
          { roleCode: 'SCREENWRITER', points: 2 },
          { roleCode: 'LEAD_PERFORMER_1', points: 1 },
          { roleCode: 'LEAD_PERFORMER_2', points: 1 },
          { roleCode: 'DIRECTOR_OF_PHOTOGRAPHY', points: 1 },
          { roleCode: 'ART_DIRECTOR', points: 1 },
          { roleCode: 'MUSIC_COMPOSER', points: 1 },
          { roleCode: 'PICTURE_EDITOR', points: 1 },
        ],
        minPoints: 6,
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
      },
      sortOrder: 3,
    },
    {
      code: 'CMF_DOCUMENTATION',
      name: 'Required Agreements & Commitments',
      requirementCategory: 'DOCUMENTATION',
      primaryFactSource: 'DOCUMENT',
      configuration: {
        requiredCategories: ['BROADCASTER_COMMITMENT', 'DISTRIBUTION_COMMITMENT'],
        optionalCategories: ['FINANCING', 'BUDGET'],
      },
      sortOrder: 4,
    },
    {
      // TODO: genre filtering not yet supported in FORMAT_ELIGIBILITY config.
      // CMF restricts eligible genres (drama, documentary, children's, variety,
      // performing arts). Add allowedGenres when FormatEligibilityConfig supports it.
      code: 'CMF_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
          'WEB_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 5,
    },
  ];

  for (const req of cmfRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: cmfVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: cmfVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const cmfProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: cmfVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: cmfVersion.id,
      status: 'ACTIVE',
    },
  });

  const cmfSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000008' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000008',
      projectProgramId: cmfProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const cmfReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: cmfVersion.id },
  });
  for (const req of cmfReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: cmfSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: cmfSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  CMF: ${cmfReqs.length} requirements, submission ${cmfSubmission.id}`);

  // ── FTTC (Alberta Film and Television Tax Credit) ──────────────────
  // Provincial refundable tax credit: 22% base (30% for Alberta-owned).
  // Services-style: no Canadian control or key creative tests.
  // Uses location-mode labour (CA-AB) and QPE-style expenditure.
  const fttcProgram = await prisma.program.upsert({
    where: { code: 'FTTC' },
    update: {},
    create: {
      code: 'FTTC',
      name: 'Alberta Film and Television Tax Credit',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'AB',
      administeredBy: 'Alberta Media Fund',
    },
  });

  const fttcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: fttcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: fttcProgram.id,
      versionCode: '2025',
      name: 'FTTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const fttcRequirements = [
    {
      code: 'FTTC_EXPENDITURE',
      name: 'Minimum Alberta Production Expenditure (≥$500K)',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, minAmount: 500000 },
      sortOrder: 1,
    },
    {
      code: 'FTTC_ALBERTA_LABOUR',
      name: 'Alberta Labour as Share of Qualified Expenditure (≥25%)',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorMode: 'location',
        numeratorLocationFilter: { country: 'CA', provinceState: 'CA-AB' },
        threshold: 0.25,
        comparison: 'gte',
        denominatorMode: 'qpe',
      },
      sortOrder: 2,
    },
    {
      code: 'FTTC_RESIDENCY',
      name: 'Prescribed Labour — Canadian Residency',
      requirementCategory: 'RESIDENCY_TEST',
      primaryFactSource: 'PARTICIPANT_RESIDENCY',
      configuration: {
        qualifyingResidency: ['CITIZEN', 'PERMANENT_RESIDENT'],
        scope: 'all_participants',
        comparison: 'gte',
      },
      sortOrder: 3,
    },
    {
      code: 'FTTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 4,
    },
    // ── Elevated tier requirements (30% rate) ──
    // These are evaluated but ONLY affect tier selection, not base eligibility.
    {
      code: 'FTTC_AB_OWNERSHIP',
      name: 'Alberta Ownership (≥50% AB-based producers)',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 50,
        qualifyingCountries: ['CA'],
        requireCreativeControl: false,
        requireFinancialControl: false,
        requireProvinceMatch: 'AB',
      },
      sortOrder: 10,
    },
    {
      code: 'FTTC_AB_PRODUCER',
      name: 'Alberta-Based Producer Credit',
      requirementCategory: 'PRODUCER_CREDIT',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        producerProvinceMatch: 'AB',
      },
      sortOrder: 11,
    },
    {
      code: 'FTTC_AB_COPYRIGHT',
      name: 'Alberta Copyright Retention (≥10 years)',
      requirementCategory: 'RIGHTS_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        requiredControlTypes: ['COPYRIGHT_OWNERSHIP'],
        qualifyingCountries: ['CA'],
        requireProvinceMatch: 'AB',
        minRetentionYears: 10,
      },
      sortOrder: 12,
    },
    {
      code: 'FTTC_AB_SPEND_RATIO',
      name: 'Alberta Spend ≥60% OR Labour ≥70%',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        currency: 'CAD',
        provinceRatioMode: true,
        provinceMatch: 'AB',
        minSpendRatio: 0.60,
        minLabourRatio: 0.70,
        comparisonMode: 'either',
      },
      sortOrder: 13,
    },
    {
      code: 'FTTC_RURAL',
      name: 'Rural/Remote Filming (≥75% shoot days)',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['AB-RURAL'],
        minDayPercentage: 0.75,
        bonusRate: 0.08,
      },
      sortOrder: 14,
    },
  ];

  for (const req of fttcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: fttcVersion.id, code: req.code },
      },
      update: {
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
      create: {
        programVersionId: fttcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const fttcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: fttcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: fttcVersion.id,
      status: 'ACTIVE',
    },
  });

  const fttcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000009' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000009',
      projectProgramId: fttcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const fttcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: fttcVersion.id },
  });
  for (const req of fttcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: fttcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: fttcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  FTTC: ${fttcReqs.length} requirements, submission ${fttcSubmission.id}`);

  // ── AMPG (Alberta Made Production Grant) ───────────────────────────
  // Small-budget provincial grant (not a tax credit). 25% of eligible
  // Alberta labour + non-labour spend. Max total budget $499,999.
  // Validates grant-with-budget-cap pattern alongside FTTC in same province.
  const ampgProgram = await prisma.program.upsert({
    where: { code: 'AMPG' },
    update: {},
    create: {
      code: 'AMPG',
      name: 'Alberta Made Production Grant',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'AB',
      administeredBy: 'Alberta Media Fund',
    },
  });

  const ampgVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: ampgProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: ampgProgram.id,
      versionCode: '2025',
      name: 'AMPG 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const ampgRequirements = [
    {
      code: 'AMPG_MIN_SPEND',
      name: 'Minimum Eligible Alberta Spend (≥$50K)',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, minAmount: 50000 },
      sortOrder: 1,
    },
    {
      code: 'AMPG_MAX_BUDGET',
      name: 'Maximum Total Production Budget (≤$499,999)',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, maxAmount: 499999 },
      sortOrder: 2,
    },
    {
      code: 'AMPG_ALBERTA_LABOUR',
      name: 'Alberta Labour & Non-Labour Expenditure',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorMode: 'location',
        numeratorLocationFilter: { country: 'CA', provinceState: 'CA-AB' },
        threshold: 0.0,
        comparison: 'gte',
        denominatorMode: 'qpe',
      },
      sortOrder: 3,
    },
    {
      code: 'AMPG_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
          'SHORT_FILM', 'WEB_SERIES',
        ],
        minRuntimeMinutes: 0,
      },
      sortOrder: 4,
    },
  ];

  for (const req of ampgRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: ampgVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: ampgVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const ampgProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: ampgVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: ampgVersion.id,
      status: 'ACTIVE',
    },
  });

  const ampgSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000010',
      projectProgramId: ampgProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const ampgReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: ampgVersion.id },
  });
  for (const req of ampgReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: ampgSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: ampgSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  AMPG: ${ampgReqs.length} requirements, submission ${ampgSubmission.id}`);

  // ── MB-FTTC (Manitoba Film and Video Production Tax Credit) ────────
  // Provincial refundable tax credit with two models (labour 45% or spend 30%).
  // Bonuses: +5% rural, +5% northern, +5% MB ownership.
  const mbFttcProgram = await prisma.program.upsert({
    where: { code: 'MB-FTTC' },
    update: {},
    create: {
      code: 'MB-FTTC',
      name: 'Manitoba Film and Video Production Tax Credit',
      scope: 'PROVINCIAL',
      country: 'CA',
      provinceState: 'MB',
      administeredBy: 'Manitoba Film & Music',
    },
  });

  const mbFttcVersion = await prisma.programVersion.upsert({
    where: {
      programId_versionCode: { programId: mbFttcProgram.id, versionCode: '2025' },
    },
    update: {},
    create: {
      programId: mbFttcProgram.id,
      versionCode: '2025',
      name: 'MB-FTTC 2025',
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    },
  });

  const mbFttcRequirements = [
    {
      code: 'MB_FTTC_EXPENDITURE',
      name: 'Minimum Manitoba Production Expenditure',
      requirementCategory: 'EXPENDITURE_THRESHOLD',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: { currency: 'CAD', labourOnly: false, minAmount: 25000 },
      sortOrder: 1,
    },
    {
      code: 'MB_FTTC_LABOUR',
      name: 'Manitoba Labour Ratio',
      requirementCategory: 'LABOUR_EXPENDITURE',
      primaryFactSource: 'EXPENSE_FACT',
      configuration: {
        numeratorMode: 'location',
        numeratorLocationFilter: { country: 'CA', provinceState: 'CA-MB' },
        threshold: 0.25,
        comparison: 'gte',
        denominatorMode: 'qpe',
      },
      sortOrder: 2,
    },
    {
      code: 'MB_FTTC_CANADIAN_CONTROL',
      name: 'Canadian Ownership & Control',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        minOwnershipPercentage: 51,
        qualifyingCountries: ['CA'],
        requireCreativeControl: true,
        requireFinancialControl: false,
      },
      sortOrder: 3,
    },
    {
      code: 'MB_FTTC_FORMAT',
      name: 'Eligible Production Format',
      requirementCategory: 'FORMAT_ELIGIBILITY',
      primaryFactSource: 'PROJECT_FORMAT',
      configuration: {
        allowedFormats: [
          'FEATURE_FILM', 'TV_SERIES', 'TV_MOVIE',
          'DOCUMENTARY_FEATURE', 'DOCUMENTARY_SERIES',
          'ANIMATION_FEATURE', 'ANIMATION_SERIES',
        ],
        minRuntimeMinutes: 30,
      },
      sortOrder: 4,
    },
    {
      code: 'MB_FTTC_RURAL',
      name: 'Rural Manitoba Filming',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['MB-RURAL'],
        minDayPercentage: 0.5,
        bonusRate: 0.05,
      },
      sortOrder: 5,
    },
    {
      code: 'MB_FTTC_NORTHERN',
      name: 'Northern Manitoba Filming',
      requirementCategory: 'REGIONAL_SPEND',
      primaryFactSource: 'ACTIVITY_DAY',
      configuration: {
        regionCodes: ['MB-NORTHERN'],
        minDayPercentage: 0.5,
        bonusRate: 0.05,
      },
      sortOrder: 6,
    },
    {
      code: 'MB_FTTC_OWNERSHIP',
      name: 'Manitoba Corporation Bonus (≥50% MB-incorporated producer)',
      requirementCategory: 'CANADIAN_CONTROL',
      primaryFactSource: 'CORPORATE_OWNERSHIP',
      configuration: {
        // Checks that ≥50% of producer ownership is held by entities
        // whose entityProvinceState = 'MB' (i.e. incorporated in Manitoba).
        // This is NOT inferred from generic producer role — requires explicit
        // province data on the ProjectOwnership entity.
        minOwnershipPercentage: 50,
        qualifyingCountries: ['CA'],
        requireCreativeControl: false,
        requireFinancialControl: false,
        requireProvinceMatch: 'MB',
      },
      sortOrder: 7,
    },
  ];

  for (const req of mbFttcRequirements) {
    await prisma.programRequirement.upsert({
      where: {
        programVersionId_code: { programVersionId: mbFttcVersion.id, code: req.code },
      },
      update: { configuration: req.configuration },
      create: {
        programVersionId: mbFttcVersion.id,
        code: req.code,
        name: req.name,
        requirementCategory: req.requirementCategory as any,
        primaryFactSource: req.primaryFactSource as any,
        configuration: req.configuration,
        isRequired: true,
        sortOrder: req.sortOrder,
      },
    });
  }

  const mbFttcProjectProgram = await prisma.projectProgram.upsert({
    where: {
      projectId_programVersionId: { projectId: project.id, programVersionId: mbFttcVersion.id },
    },
    update: {},
    create: {
      projectId: project.id,
      organizationId: org.id,
      programVersionId: mbFttcVersion.id,
      status: 'ACTIVE',
    },
  });

  const mbFttcSubmission = await prisma.programSubmission.upsert({
    where: { id: '00000000-0000-0000-0000-100000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-100000000020',
      projectProgramId: mbFttcProjectProgram.id,
      organizationId: org.id,
      evaluationDate: new Date(),
      budgetVersionId: budgetVersion.id,
      status: 'DRAFT',
      createdById: user.id,
    },
  });

  const mbFttcReqs = await prisma.programRequirement.findMany({
    where: { programVersionId: mbFttcVersion.id },
  });

  for (const req of mbFttcReqs) {
    await prisma.requirementAssessment.upsert({
      where: {
        submissionId_requirementId: {
          submissionId: mbFttcSubmission.id,
          requirementId: req.id,
        },
      },
      update: {},
      create: {
        submissionId: mbFttcSubmission.id,
        organizationId: org.id,
        requirementId: req.id,
        result: 'NOT_EVALUATED',
      },
    });
  }

  console.log(`  MB-FTTC: ${mbFttcReqs.length} requirements, submission ${mbFttcSubmission.id}`);

  console.log('Dev seed complete.');
  console.log(`  Login: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
  console.log(`  Org: ${org.name} (${org.slug})`);
  console.log(`  Project: ${project.title}`);
  console.log(`  Submission (DEV): ${programSubmission.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
