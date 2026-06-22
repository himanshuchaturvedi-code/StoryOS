/**
 * Minimal document generation types — enough for CPTC Part A end-to-end.
 * Will evolve as more document types are added.
 */

import type { BocAllocationTrace, BocSummaryLineDefinition } from './boc-registry';

export * from './boc-registry';

export type DocumentTypeCode = 'CPTC_PART_A' | 'AMPG_AB_SPEND_SUMMARY';

export * from './ampg-spend-summary';

export interface DocumentWarning {
  fieldId?: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface BocRow {
  accountCode: string;
  accountName: string;
  keyCreativeCanadian: number;
  keyCreativeNonCanadian: number;
  servicesCanadian: number;
  servicesNonCanadian: number;
  postProductionLabCanadian: number;
  postProductionLabNonCanadian: number;
  otherCosts: number;
  total: number;
  isHeader: boolean;
  indent: number;
}

export interface BocSummary {
  totalCostOfProduction: number;
  totalServicesCanadian: number;
  totalServicesNonCanadian: number;
  totalServices: number;
  servicesCanadianRatio: number;
  totalPostLabCanadian: number;
  totalPostLabNonCanadian: number;
  totalPostLab: number;
  postLabCanadianRatio: number;
}

export interface CptcPartADocument {
  documentType: 'CPTC_PART_A';
  projectTitle: string;
  budgetVersionId: string;
  budgetVersionName: string;
  /** CPTC form code (01F21 live action or 01F22 animation). */
  formCode: string;
  /** Human-readable form title from registry meta.formLabel. */
  formLabel: string;
  /** Registry summary row definitions used for PDF rendering. */
  summaryLineDefinitions: BocSummaryLineDefinition[];
  rows: BocRow[];
  summary: BocSummary;
  warnings: DocumentWarning[];
  /** Budget-line allocation audit trail (Slice 4D+, not rendered on PDF). */
  allocationTrace?: BocAllocationTrace[];
  generatedAt: Date;
}
