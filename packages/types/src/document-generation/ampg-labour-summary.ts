import type { DocumentWarning } from './index';

export interface AmpgLabourSummaryRow {
  lineId: string;
  accountCode: string;
  accountName: string;
  payeeLabel: string | null;
  personId: string | null;
  residencyCountry: string | null;
  residencyProvince: string | null;
  labourAmount: number;
}

export interface AmpgLabourPersonIndexEntry {
  personId: string;
  payeeLabel: string;
  totalLabourAmount: number;
}

export interface AmpgLabourSummaryTotals {
  totalLabour: number;
  albertaResidentLabour: number;
  nonAlbertaOrUnknownLabour: number;
  distinctAlbertaResidentPersonCount: number;
}

export interface AmpgLabourSummaryDocument {
  documentType: 'AMPG_AB_LABOUR_SUMMARY';
  projectTitle: string;
  budgetVersionId: string;
  budgetVersionName: string;
  rows: AmpgLabourSummaryRow[];
  personIndex: AmpgLabourPersonIndexEntry[];
  summary: AmpgLabourSummaryTotals;
  warnings: DocumentWarning[];
  generatedAt: Date;
}
