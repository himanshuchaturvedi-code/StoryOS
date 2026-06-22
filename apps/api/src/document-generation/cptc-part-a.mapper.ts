import { ExpenseType } from '@storyos/types';
import type {
  BocRow,
  BocSummary,
  CptcPartADocument,
  DocumentWarning,
} from '@storyos/types';
import type {
  BudgetLineWithRelations,
  CptcPartAData,
} from './cptc-part-a.collector';

/**
 * BOC column classification for a single budget line.
 * Determines which value column a line's classifiable amount falls into.
 */
export type ColumnKey =
  | 'keyCreativeCanadian'
  | 'keyCreativeNonCanadian'
  | 'servicesCanadian'
  | 'servicesNonCanadian'
  | 'postProductionLabCanadian'
  | 'postProductionLabNonCanadian'
  | 'otherCosts';

const CPTC_ROLES = new Set([
  'DIRECTOR',
  'SCREENWRITER',
  'LEAD_PERFORMER_1',
  'LEAD_PERFORMER_2',
  'DIRECTOR_OF_PHOTOGRAPHY',
  'ART_DIRECTOR',
  'MUSIC_COMPOSER',
  'PICTURE_EDITOR',
]);

export interface LineAmountSplit {
  /** Amount routed through residency / role classification. */
  classifiableAmount: number;
  /** Non-labour remainder (MIXED lines) placed directly in Other Costs. */
  otherCostsAmount: number;
  warnings: DocumentWarning[];
}

/**
 * Pure function: maps collected StoryOS data into a CPTC Part A
 * Breakdown of Costs document structure.
 */
export function mapCptcPartA(data: CptcPartAData): CptcPartADocument {
  const warnings: DocumentWarning[] = [];

  const accountBuckets = new Map<
    string,
    {
      accountCode: string;
      accountName: string;
      isHeader: boolean;
      parentId: string | null;
      sortOrder: number;
      columns: Record<ColumnKey, number>;
    }
  >();

  let unclassifiedCount = 0;
  let ineligibleExcludedCount = 0;
  let ineligibleExcludedTotal = 0;

  for (const line of data.lines) {
    const amount = Number(line.amount);
    if (amount === 0) continue;

    if (line.taxCreditIneligible) {
      ineligibleExcludedCount++;
      ineligibleExcludedTotal += amount;
      continue;
    }

    const split = resolveLineAmountSplit(line);
    warnings.push(...split.warnings);

    const acct = line.account;
    const key = acct.id;

    if (!accountBuckets.has(key)) {
      accountBuckets.set(key, emptyAccountBucket(acct));
    }

    const bucket = accountBuckets.get(key)!;

    if (split.otherCostsAmount > 0) {
      bucket.columns.otherCosts += split.otherCostsAmount;
    }

    if (split.classifiableAmount === 0) {
      continue;
    }

    const col = classifyLine(line, data.residencies);

    if (!col) {
      unclassifiedCount++;
      bucket.columns.otherCosts += split.classifiableAmount;
    } else {
      bucket.columns[col] += split.classifiableAmount;
    }
  }

  if (ineligibleExcludedCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${ineligibleExcludedCount} budget line(s) marked tax-credit ineligible were excluded from the Breakdown of Costs (total ${formatCurrency(ineligibleExcludedTotal)}).`,
    });
  }

  if (unclassifiedCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${unclassifiedCount} budget line(s) could not be fully classified (missing person/vendor or residency data). Classifiable amounts placed in "Other Costs".`,
    });
  }

  const sortedBuckets = [...accountBuckets.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  const rows: BocRow[] = sortedBuckets.map((b) => ({
    accountCode: b.accountCode,
    accountName: b.accountName,
    isHeader: b.isHeader,
    indent: b.parentId ? 1 : 0,
    ...b.columns,
    total: sumRowColumns(b.columns),
  }));

  const summary = computeSummary(rows);

  return {
    documentType: 'CPTC_PART_A',
    projectTitle: data.project.title,
    budgetVersionId: data.budgetVersionId,
    budgetVersionName: data.budgetVersionName,
    rows,
    summary,
    warnings,
    generatedAt: new Date(),
  };
}

function emptyAccountBucket(acct: BudgetLineWithRelations['account']) {
  return {
    accountCode: acct.code,
    accountName: acct.name,
    isHeader: acct.isHeader,
    parentId: acct.parentId,
    sortOrder: acct.sortOrder,
    columns: {
      keyCreativeCanadian: 0,
      keyCreativeNonCanadian: 0,
      servicesCanadian: 0,
      servicesNonCanadian: 0,
      postProductionLabCanadian: 0,
      postProductionLabNonCanadian: 0,
      otherCosts: 0,
    },
  };
}

function sumRowColumns(columns: Record<ColumnKey, number>): number {
  return (
    columns.keyCreativeCanadian +
    columns.keyCreativeNonCanadian +
    columns.servicesCanadian +
    columns.servicesNonCanadian +
    columns.postProductionLabCanadian +
    columns.postProductionLabNonCanadian +
    columns.otherCosts
  );
}

/**
 * Splits a budget line into classifiable labour (or full) amount and
 * non-labour remainder based on expenseType and labourAmount.
 */
export function resolveLineAmountSplit(line: BudgetLineWithRelations): LineAmountSplit {
  const amount = Number(line.amount);
  const warnings: DocumentWarning[] = [];
  const labourAmount =
    line.labourAmount != null ? Number(line.labourAmount) : null;

  if (line.expenseType === ExpenseType.NON_LABOUR) {
    return { classifiableAmount: amount, otherCostsAmount: 0, warnings };
  }

  if (line.expenseType === ExpenseType.LABOUR) {
    const classifiableAmount = labourAmount ?? amount;
    if (labourAmount != null && labourAmount > amount) {
      warnings.push({
        fieldId: line.id,
        severity: 'warning',
        message: `Budget line "${line.description ?? line.account.name}" has labourAmount exceeding line amount; using line amount.`,
      });
    }
    return {
      classifiableAmount: Math.min(classifiableAmount, amount),
      otherCostsAmount: 0,
      warnings,
    };
  }

  if (line.expenseType === ExpenseType.MIXED) {
    if (labourAmount == null) {
      warnings.push({
        fieldId: line.id,
        severity: 'warning',
        message: `Budget line "${line.description ?? line.account.name}" is MIXED but labourAmount is not set; classifying full amount.`,
      });
      return { classifiableAmount: amount, otherCostsAmount: 0, warnings };
    }

    const labourPortion = Math.min(Math.max(labourAmount, 0), amount);
    const nonLabourPortion = Math.max(amount - labourPortion, 0);
    if (labourAmount < 0 || labourAmount > amount) {
      warnings.push({
        fieldId: line.id,
        severity: 'warning',
        message: `Budget line "${line.description ?? line.account.name}" has invalid labourAmount for MIXED expense; using clamped split.`,
      });
    }
    return {
      classifiableAmount: labourPortion,
      otherCostsAmount: nonLabourPortion,
      warnings,
    };
  }

  return { classifiableAmount: amount, otherCostsAmount: 0, warnings };
}

export function classifyLine(
  line: BudgetLineWithRelations,
  residencies: Map<string, { residencyType: string; country: string }>,
): ColumnKey | null {
  const acct = line.account;
  const cptcMapping = acct.roleMappings.find((rm) => rm.programCode === 'CPTC');
  const isKeyCreative =
    cptcMapping != null && CPTC_ROLES.has(cptcMapping.roleCode);
  const isPostProduction = acct.accountType === 'BELOW_THE_LINE_POST';
  const isOther = acct.accountType === 'OTHER';

  if (isOther) return 'otherCosts';

  const isCanadian = resolveCanadian(line, residencies);

  if (isPostProduction) {
    if (isCanadian === null) return null;
    return isCanadian
      ? 'postProductionLabCanadian'
      : 'postProductionLabNonCanadian';
  }

  if (isKeyCreative) {
    if (isCanadian === null) return null;
    return isCanadian ? 'keyCreativeCanadian' : 'keyCreativeNonCanadian';
  }

  if (isCanadian === null) return null;
  return isCanadian ? 'servicesCanadian' : 'servicesNonCanadian';
}

function resolveCanadian(
  line: BudgetLineWithRelations,
  residencies: Map<string, { residencyType: string; country: string }>,
): boolean | null {
  const effectivePersonId =
    line.personId ?? line.vendor?.principalPersonId ?? null;

  if (effectivePersonId) {
    const res = residencies.get(effectivePersonId);
    if (res) {
      return (
        res.country === 'CA' &&
        (res.residencyType === 'CITIZEN' ||
          res.residencyType === 'PERMANENT_RESIDENT')
      );
    }
  }

  if (line.vendor) {
    return line.vendor.country === 'CA';
  }

  if (line.location) {
    return line.location.country === 'CA';
  }

  return null;
}

/** Exported for unit tests. */
export function computeSummary(rows: BocRow[]): BocSummary {
  let totalCost = 0;
  let keyCreativeCanadian = 0;
  let keyCreativeNonCanadian = 0;
  let postCan = 0;
  let postNonCan = 0;

  for (const row of rows) {
    if (row.isHeader) continue;
    totalCost += row.total;
    keyCreativeCanadian += row.keyCreativeCanadian;
    keyCreativeNonCanadian += row.keyCreativeNonCanadian;
    postCan += row.postProductionLabCanadian;
    postNonCan += row.postProductionLabNonCanadian;
  }

  const totalServices = keyCreativeCanadian + keyCreativeNonCanadian;
  const totalPostLab = postCan + postNonCan;

  return {
    totalCostOfProduction: totalCost,
    totalServicesCanadian: keyCreativeCanadian,
    totalServicesNonCanadian: keyCreativeNonCanadian,
    totalServices,
    servicesCanadianRatio: totalServices > 0 ? keyCreativeCanadian / totalServices : 0,
    totalPostLabCanadian: postCan,
    totalPostLabNonCanadian: postNonCan,
    totalPostLab,
    postLabCanadianRatio: totalPostLab > 0 ? postCan / totalPostLab : 0,
  };
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
