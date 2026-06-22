import type { DocumentWarning } from './index';

export interface AmpgSpendSummaryRow {
  lineId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  payeeLabel: string | null;
  provinceState: string | null;
  labourAmount: number;
  nonLabourAmount: number;
  totalAmount: number;
}

export interface AmpgSpendSummaryTotals {
  albertaLabourTotal: number;
  albertaNonLabourTotal: number;
  totalAlbertaEligibleSpend: number;
  totalProductionBudget: number;
  albertaSpendRatio: number;
  /** Total eligible Alberta spend used as the AMPG grant base. */
  estimatedAmpgGrantBase: number;
  /** AMPG grant estimate (base × program rate, typically 25%). */
  estimatedAmpgGrantAmount: number;
}

export interface AmpgSpendSummaryDocument {
  documentType: 'AMPG_AB_SPEND_SUMMARY';
  projectTitle: string;
  budgetVersionId: string;
  budgetVersionName: string;
  rows: AmpgSpendSummaryRow[];
  summary: AmpgSpendSummaryTotals;
  warnings: DocumentWarning[];
  generatedAt: Date;
}
