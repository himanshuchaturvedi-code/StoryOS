import type {
  AmpgLabourPersonIndexEntry,
  AmpgLabourSummaryDocument,
  AmpgLabourSummaryRow,
  DocumentWarning,
} from '@storyos/types';
import type { AmpgBudgetData } from './ampg-budget.collector';
import type { BudgetLineWithRelations } from './cptc-part-a.collector';
import {
  isAlbertaResident,
  resolveEffectivePersonId,
  resolveIsLabourLine,
  resolveLabourLineAmount,
  resolveLabourPayeeLabel,
} from './ampg-labour-utils';

export { isAlbertaResident } from './ampg-labour-utils';

const AMPG_RESIDENCY_CERTIFICATION_WARNING =
  'StoryOS does not certify AMPG Alberta residency (Dec 31 / 3-year rule). ' +
  'This summary is not a substitute for signed Alberta Residency Confirmation forms.';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapAmpgLabourSummary(data: AmpgBudgetData): AmpgLabourSummaryDocument {
  const warnings: DocumentWarning[] = [
    {
      severity: 'warning',
      message: AMPG_RESIDENCY_CERTIFICATION_WARNING,
    },
  ];
  const rows: AmpgLabourSummaryRow[] = [];

  let totalLabour = 0;
  let albertaResidentLabour = 0;
  let nonAlbertaOrUnknownLabour = 0;

  let noPersonCount = 0;
  let missingResidencyCount = 0;
  let nonAlbertaResidencyCount = 0;
  let vendorNoPrincipalCount = 0;

  const albertaPersonTotals = new Map<string, AmpgLabourPersonIndexEntry>();

  for (const line of data.lines) {
    if (!resolveIsLabourLine(line)) {
      continue;
    }

    const labourAmount = resolveLabourLineAmount(line);
    if (labourAmount <= 0) {
      continue;
    }

    totalLabour += labourAmount;

    const effectivePersonId = resolveEffectivePersonId(line);
    const payeeLabel = resolveLabourPayeeLabel(line);
    const vendorWithoutPrincipal =
      Boolean(line.vendorId) && !line.personId && !line.vendor?.principalPersonId;

    if (vendorWithoutPrincipal) {
      vendorNoPrincipalCount++;
      nonAlbertaOrUnknownLabour += labourAmount;
      continue;
    }

    if (!effectivePersonId) {
      noPersonCount++;
      nonAlbertaOrUnknownLabour += labourAmount;
      continue;
    }

    const residency = data.residencies.get(effectivePersonId);
    if (!residency) {
      missingResidencyCount++;
      nonAlbertaOrUnknownLabour += labourAmount;
      continue;
    }

    if (!isAlbertaResident(residency)) {
      nonAlbertaResidencyCount++;
      nonAlbertaOrUnknownLabour += labourAmount;
      continue;
    }

    albertaResidentLabour += labourAmount;
    rows.push(buildIncludedRow(line, effectivePersonId, payeeLabel, residency, labourAmount));
    accumulatePersonIndex(
      albertaPersonTotals,
      effectivePersonId,
      payeeLabel ?? 'Unknown payee',
      labourAmount,
    );
  }

  appendCountWarning(warnings, noPersonCount, 'labour line(s) have no person or vendor principal person assigned');
  appendCountWarning(warnings, missingResidencyCount, 'labour payee(s) are missing residency status');
  appendCountWarning(
    warnings,
    nonAlbertaResidencyCount,
    'labour payee(s) have residency outside Alberta',
  );
  appendCountWarning(
    warnings,
    vendorNoPrincipalCount,
    'vendor labour line(s) have no principal person for residency lookup',
  );

  return {
    documentType: 'AMPG_AB_LABOUR_SUMMARY',
    projectTitle: data.project.title,
    budgetVersionId: data.budgetVersionId,
    budgetVersionName: data.budgetVersionName,
    rows,
    personIndex: [...albertaPersonTotals.values()].sort((a, b) =>
      a.payeeLabel.localeCompare(b.payeeLabel),
    ),
    summary: {
      totalLabour: roundMoney(totalLabour),
      albertaResidentLabour: roundMoney(albertaResidentLabour),
      nonAlbertaOrUnknownLabour: roundMoney(nonAlbertaOrUnknownLabour),
      distinctAlbertaResidentPersonCount: albertaPersonTotals.size,
    },
    warnings,
    generatedAt: new Date(),
  };
}

function buildIncludedRow(
  line: BudgetLineWithRelations,
  personId: string,
  payeeLabel: string | null,
  residency: { country: string; provinceState: string | null },
  labourAmount: number,
): AmpgLabourSummaryRow {
  return {
    lineId: line.id,
    accountCode: line.account?.code ?? '',
    accountName: line.account?.name ?? '',
    payeeLabel,
    personId,
    residencyCountry: residency.country,
    residencyProvince: residency.provinceState,
    labourAmount: roundMoney(labourAmount),
  };
}

function accumulatePersonIndex(
  index: Map<string, AmpgLabourPersonIndexEntry>,
  personId: string,
  payeeLabel: string,
  labourAmount: number,
): void {
  const existing = index.get(personId);
  if (existing) {
    existing.totalLabourAmount = roundMoney(existing.totalLabourAmount + labourAmount);
    return;
  }

  index.set(personId, {
    personId,
    payeeLabel,
    totalLabourAmount: roundMoney(labourAmount),
  });
}

function appendCountWarning(
  warnings: DocumentWarning[],
  count: number,
  messageSuffix: string,
): void {
  if (count <= 0) return;
  warnings.push({
    severity: 'warning',
    message: `${count} ${messageSuffix}`,
  });
}
