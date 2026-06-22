import type {
  BocAllocationTrace,
  BocColumnFamily,
  BocColumnKey,
  BocFormLineDefinition,
  BocFormRegistry,
  BocRow,
  BocSummary,
  CptcPartADocument,
  DocumentWarning,
} from '@storyos/types';
import {
  CPTC_BOC_REGISTRY_TEMPLATE_ID,
  isLineCodeWithinRange,
  loadCptcBocRegistry,
  resolveFormLinesForAccount,
  resolvePrimaryFormLineForAccount,
  resolveRollupKindForAccount,
} from '@storyos/program-registry';
import type { BudgetLineWithRelations } from './cptc-part-a.collector';
import type { CptcPartAData } from './cptc-part-a.collector';
import {
  classifyLine,
  resolveCanadian,
  resolveLineAmountSplit,
  type ColumnKey,
} from './cptc-part-a.mapper';

type ColumnTotals = Record<BocColumnKey, number>;

function emptyColumns(): ColumnTotals {
  return {
    keyCreativeCanadian: 0,
    keyCreativeNonCanadian: 0,
    servicesCanadian: 0,
    servicesNonCanadian: 0,
    postProductionLabCanadian: 0,
    postProductionLabNonCanadian: 0,
    otherCosts: 0,
  };
}

function sumColumns(columns: ColumnTotals): number {
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

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function placeAmountInAllowedColumn(
  column: ColumnKey | null,
  amount: number,
  allowedColumns: BocColumnKey[],
): BocColumnKey | null {
  if (amount === 0) return null;
  if (column != null && allowedColumns.includes(column)) {
    return column;
  }
  if (allowedColumns.includes('otherCosts')) {
    return 'otherCosts';
  }
  if (column === 'otherCosts' && allowedColumns.length === 0) {
    return null;
  }
  return allowedColumns[0] ?? null;
}

function addToColumn(columns: ColumnTotals, column: BocColumnKey, amount: number) {
  columns[column] += amount;
}

function columnFromKeyCreativeResidency(
  isCanadian: boolean,
  allowedColumns: BocColumnKey[],
): BocColumnKey | null {
  if (isCanadian) {
    return allowedColumns.includes('keyCreativeCanadian') ? 'keyCreativeCanadian' : null;
  }
  return allowedColumns.includes('keyCreativeNonCanadian')
    ? 'keyCreativeNonCanadian'
    : null;
}

function columnFromProducerResidency(
  isCanadian: boolean,
  allowedColumns: BocColumnKey[],
): BocColumnKey | null {
  if (isCanadian) {
    if (allowedColumns.includes('keyCreativeCanadian')) {
      return 'keyCreativeCanadian';
    }
    if (allowedColumns.includes('servicesCanadian')) {
      return 'servicesCanadian';
    }
    return null;
  }

  if (allowedColumns.includes('servicesNonCanadian')) {
    return 'servicesNonCanadian';
  }
  if (allowedColumns.includes('keyCreativeNonCanadian')) {
    return 'keyCreativeNonCanadian';
  }
  return null;
}

function columnFromServicesResidency(
  isCanadian: boolean,
  allowedColumns: BocColumnKey[],
): BocColumnKey | null {
  if (isCanadian) {
    return allowedColumns.includes('servicesCanadian') ? 'servicesCanadian' : null;
  }
  return allowedColumns.includes('servicesNonCanadian') ? 'servicesNonCanadian' : null;
}

/**
 * Registry-driven column placement for 01F21 form lines.
 * Form column families take precedence over CPTC role inference.
 */
export function classifyForFormLine(
  line: BudgetLineWithRelations,
  residencies: Map<string, { residencyType: string; country: string }>,
  formLine: BocFormLineDefinition,
): ColumnKey | null {
  const acct = line.account;
  if (acct.accountType === 'OTHER') {
    return formLine.allowedColumns.includes('otherCosts') ? 'otherCosts' : null;
  }

  const isCanadian = resolveCanadian(line, residencies);
  const family = formLine.columnFamily;

  if (family === 'other') {
    return formLine.allowedColumns.includes('otherCosts') ? 'otherCosts' : null;
  }

  if (family === 'postProduction') {
    if (isCanadian === null) return null;
    const column = isCanadian
      ? 'postProductionLabCanadian'
      : 'postProductionLabNonCanadian';
    return formLine.allowedColumns.includes(column) ? column : null;
  }

  if (family === 'keyCreative') {
    if (isCanadian === null) return null;
    return columnFromKeyCreativeResidency(isCanadian, formLine.allowedColumns);
  }

  if (
    family === 'producerRemuneration' ||
    family === 'lineProducerRemuneration' ||
    family === 'producerTravel' ||
    family === 'lineProducerTravel'
  ) {
    if (isCanadian === null) return null;
    return columnFromProducerResidency(isCanadian, formLine.allowedColumns);
  }

  if (family === 'producerServices' || family === 'services') {
    if (isCanadian === null) return null;
    return columnFromServicesResidency(isCanadian, formLine.allowedColumns);
  }

  return classifyLine(line, residencies);
}

/**
 * Maps collected budget data into official 01F21 form lines using the CPTC BOC registry.
 */
export function mapCptcPartAWithRegistry(
  data: CptcPartAData,
  registry: BocFormRegistry = loadCptcBocRegistry(),
  templateId: string = registry.meta.templateVersion || CPTC_BOC_REGISTRY_TEMPLATE_ID,
): CptcPartADocument {
  const warnings: DocumentWarning[] = [];
  const allocationTrace: BocAllocationTrace[] = [];
  const lineBuckets = new Map<string, ColumnTotals>();

  for (const formLine of registry.lines) {
    lineBuckets.set(formLine.code, emptyColumns());
  }

  let unmappedCount = 0;
  let unmappedTotal = 0;
  let ineligibleExcludedCount = 0;
  let ineligibleExcludedTotal = 0;
  let ambiguousMappingCount = 0;
  let columnConstraintCount = 0;
  let unclassifiedCount = 0;

  for (const line of data.lines) {
    const amount = Number(line.amount);
    if (amount === 0) continue;

    if (line.taxCreditIneligible) {
      ineligibleExcludedCount++;
      ineligibleExcludedTotal += amount;
      continue;
    }

    const accountCode = line.account.code;
    const matchingLines = resolveFormLinesForAccount(registry, templateId, accountCode);
    const primaryLine = resolvePrimaryFormLineForAccount(registry, templateId, accountCode);

    if (!primaryLine) {
      unmappedCount++;
      unmappedTotal += amount;
      continue;
    }

    if (matchingLines.length > 1) {
      ambiguousMappingCount++;
    }

    if (primaryLine.forceEmpty) {
      warnings.push({
        fieldId: line.id,
        severity: 'warning',
        message: `Budget account ${accountCode} maps to form line ${primaryLine.code} (${primaryLine.label}), which must remain empty on the official 01F21 form; amount excluded.`,
      });
      continue;
    }

    const split = resolveLineAmountSplit(line);
    warnings.push(...split.warnings);

    const bucket = lineBuckets.get(primaryLine.code)!;
    const allowedColumns = primaryLine.allowedColumns;
    const rollupKind = resolveRollupKindForAccount(primaryLine, templateId, accountCode);

    const recordTrace = (column: BocColumnKey, traceAmount: number) => {
      allocationTrace.push({
        budgetLineId: line.id,
        accountCode,
        amount: traceAmount,
        formLineCode: primaryLine.code,
        column,
        rollupKind,
      });
    };

    if (split.otherCostsAmount > 0) {
      const otherColumn = placeAmountInAllowedColumn(
        'otherCosts',
        split.otherCostsAmount,
        allowedColumns,
      );
      if (otherColumn) {
        addToColumn(bucket, otherColumn, split.otherCostsAmount);
        recordTrace(otherColumn, split.otherCostsAmount);
      } else {
        columnConstraintCount++;
      }
    }

    if (split.classifiableAmount === 0) continue;

    const classified =
      primaryLine.columnFamily != null
        ? classifyForFormLine(line, data.residencies, primaryLine)
        : classifyLine(line, data.residencies);

    if (classified == null) {
      unclassifiedCount++;
    }

    const targetColumn = placeAmountInAllowedColumn(
      classified,
      split.classifiableAmount,
      allowedColumns,
    );

    if (!targetColumn) {
      columnConstraintCount++;
      continue;
    }

    if (classified != null && classified !== targetColumn) {
      columnConstraintCount++;
    }

    addToColumn(bucket, targetColumn, split.classifiableAmount);
    recordTrace(targetColumn, split.classifiableAmount);
  }

  if (ineligibleExcludedCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${ineligibleExcludedCount} budget line(s) marked tax-credit ineligible were excluded from the Breakdown of Costs (total ${formatCurrency(ineligibleExcludedTotal)}).`,
    });
  }

  if (unmappedCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${unmappedCount} budget line(s) from unmapped Telefilm account(s) were excluded from the 01F21 Breakdown of Costs (total ${formatCurrency(unmappedTotal)}).`,
    });
  }

  if (unclassifiedCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${unclassifiedCount} budget line(s) could not be fully classified (missing person/vendor or residency data). Amounts placed using available column rules.`,
    });
  }

  if (ambiguousMappingCount > 0) {
    warnings.push({
      severity: 'info',
      message: `${ambiguousMappingCount} budget line(s) matched multiple 01F21 form lines; amounts were allocated to the primary registry mapping.`,
    });
  }

  if (columnConstraintCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${columnConstraintCount} budget line portion(s) could not be placed in an allowed column for their 01F21 form line and were omitted.`,
    });
  }

  const rows: BocRow[] = registry.lines.map((formLine) => {
    const columns = lineBuckets.get(formLine.code) ?? emptyColumns();
    return {
      accountCode: formLine.code,
      accountName: formLine.label,
      isHeader: formLine.isHeader === true,
      indent: formLine.parentCode ? 1 : 0,
      ...columns,
      total: formLine.isHeader || formLine.forceEmpty ? 0 : sumColumns(columns),
    };
  });

  const summary = computeRegistrySummary(rows, registry);

  return {
    documentType: 'CPTC_PART_A',
    projectTitle: data.project.title,
    budgetVersionId: data.budgetVersionId,
    budgetVersionName: data.budgetVersionName,
    rows,
    summary,
    warnings,
    allocationTrace,
    generatedAt: new Date(),
  };
}

/** 01F21 summary rows — Total Services uses Key Creative columns only (form 11.1). */
export function computeRegistrySummary(
  rows: BocRow[],
  registry: BocFormRegistry,
): BocSummary {
  const dataRows = rows.filter((row) => !row.isHeader);

  const sumLineRange = registry.summaryLines.find((line) => line.code === '11.0');
  const rangeStart = sumLineRange?.sourceLineRange?.[0] ?? '1.0';
  const rangeEnd = sumLineRange?.sourceLineRange?.[1] ?? '10.5';

  let totalCostOfProduction = 0;
  let keyCreativeCanadian = 0;
  let keyCreativeNonCanadian = 0;
  let postLabCanadian = 0;
  let postLabNonCanadian = 0;

  for (const row of dataRows) {
    if (!isLineCodeWithinRange(row.accountCode, rangeStart, rangeEnd)) continue;
    totalCostOfProduction += row.total;
    keyCreativeCanadian += row.keyCreativeCanadian;
    keyCreativeNonCanadian += row.keyCreativeNonCanadian;
    postLabCanadian += row.postProductionLabCanadian;
    postLabNonCanadian += row.postProductionLabNonCanadian;
  }

  const totalServices = keyCreativeCanadian + keyCreativeNonCanadian;
  const totalPostLab = postLabCanadian + postLabNonCanadian;

  return {
    totalCostOfProduction,
    totalServicesCanadian: keyCreativeCanadian,
    totalServicesNonCanadian: keyCreativeNonCanadian,
    totalServices,
    servicesCanadianRatio:
      totalServices > 0 ? keyCreativeCanadian / totalServices : 0,
    totalPostLabCanadian: postLabCanadian,
    totalPostLabNonCanadian: postLabNonCanadian,
    totalPostLab,
    postLabCanadianRatio: totalPostLab > 0 ? postLabCanadian / totalPostLab : 0,
  };
}

export function getRegistryLineDefinition(
  registry: BocFormRegistry,
  lineCode: string,
): BocFormLineDefinition | undefined {
  return registry.lines.find((line) => line.code === lineCode);
}
