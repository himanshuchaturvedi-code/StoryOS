import type { EvaluationSource } from '../enums';

/**
 * Source-agnostic representation of an eligible spend line.
 *
 * Both ExpenseFact (actuals) and enriched BudgetLine (budget) project
 * into this common shape. Expenditure-based calculators operate on
 * SpendRecord[] instead of querying source-specific tables directly.
 *
 * See PART-A-CALCULATION-ARCHITECTURE.md §2.
 */
export interface SpendRecord {
  sourceId: string;
  sourceType: EvaluationSource;

  amount: string;
  labourAmount: string | null;
  isLabour: boolean;
  isService: boolean;
  eligiblePortion: string;

  effectivePersonId: string | null;
  vendorId: string | null;
  locationId: string | null;
  productionPhaseId: string | null;
  budgetAccountId: string | null;
  activityType: string | null;

  /**
   * When true, this line has been marked ineligible for tax credit calculations
   * (e.g. website costs, partial craft services, application fees).
   */
  taxCreditIneligible: boolean;

  account: {
    code: string;
    name: string;
    accountType: string | null;
  } | null;

  location: {
    country: string;
    provinceState: string | null;
    incentiveRegionCode: string | null;
  } | null;
}

/**
 * Filter options for getSpendRecords().
 */
export interface SpendRecordFilters {
  isLabour?: boolean;
  isService?: boolean;
  accountTypes?: string[];
  activityTypes?: string[];
  locationFilter?: {
    country?: string;
    provinceState?: string;
    regionCodes?: string[];
  };
}
