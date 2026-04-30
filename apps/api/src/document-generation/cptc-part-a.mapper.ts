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
 * Determines which of the 6 value columns a line's amount falls into.
 */
type ColumnKey =
  | 'keyCreativeCanadian'
  | 'keyCreativeNonCanadian'
  | 'servicesCanadian'
  | 'servicesNonCanadian'
  | 'postProductionLab'
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

  for (const line of data.lines) {
    const amount = Number(line.amount);
    if (amount === 0) continue;

    const acct = line.account;
    const key = acct.id;

    if (!accountBuckets.has(key)) {
      accountBuckets.set(key, {
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
          postProductionLab: 0,
          otherCosts: 0,
        },
      });
    }

    const bucket = accountBuckets.get(key)!;
    const col = classifyLine(line, data.residencies);

    if (!col) {
      unclassifiedCount++;
      bucket.columns.otherCosts += amount;
    } else {
      bucket.columns[col] += amount;
    }
  }

  if (unclassifiedCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${unclassifiedCount} budget line(s) could not be fully classified (missing person/vendor or residency data). Amounts placed in "Other Costs".`,
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
    total:
      b.columns.keyCreativeCanadian +
      b.columns.keyCreativeNonCanadian +
      b.columns.servicesCanadian +
      b.columns.servicesNonCanadian +
      b.columns.postProductionLab +
      b.columns.otherCosts,
  }));

  const summary = computeSummary(rows);

  return {
    documentType: 'CPTC_PART_A',
    projectTitle: data.project.title,
    rows,
    summary,
    warnings,
    generatedAt: new Date(),
  };
}

function classifyLine(
  line: BudgetLineWithRelations,
  residencies: Map<string, { residencyType: string; country: string }>,
): ColumnKey | null {
  const acct = line.account;
  const cptcMapping = acct.roleMappings.find(rm => rm.programCode === 'CPTC');
  const isKeyCreative = cptcMapping != null && CPTC_ROLES.has(cptcMapping.roleCode);
  const isPostProduction = acct.accountType === 'BELOW_THE_LINE_POST';
  const isOther = acct.accountType === 'OTHER';

  if (isOther) return 'otherCosts';
  if (isPostProduction) return 'postProductionLab';

  const isCanadian = resolveCanadian(line, residencies);

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

function computeSummary(rows: BocRow[]): BocSummary {
  let totalCost = 0;
  let svcCan = 0;
  let svcNonCan = 0;
  let postCan = 0;
  let postNonCan = 0;

  for (const row of rows) {
    if (row.isHeader) continue;
    totalCost += row.total;
    svcCan += row.servicesCanadian + row.keyCreativeCanadian;
    svcNonCan += row.servicesNonCanadian + row.keyCreativeNonCanadian;
    postCan += row.postProductionLab;
  }

  const totalServices = svcCan + svcNonCan;
  const totalPostLab = postCan + postNonCan;

  return {
    totalCostOfProduction: totalCost,
    totalServicesCanadian: svcCan,
    totalServicesNonCanadian: svcNonCan,
    totalServices,
    servicesCanadianRatio: totalServices > 0 ? svcCan / totalServices : 0,
    totalPostLabCanadian: postCan,
    totalPostLabNonCanadian: postNonCan,
    totalPostLab,
    postLabCanadianRatio: totalPostLab > 0 ? postCan / totalPostLab : 0,
  };
}
