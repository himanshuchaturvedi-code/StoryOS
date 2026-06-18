import type { DocumentCategory } from '../enums';

/**
 * Obligation level for a program document requirement.
 * Only REQUIRED documents block stage completion in future workflow phases.
 */
export enum DocumentRequirementLevel {
  REQUIRED = 'REQUIRED',
  OPTIONAL = 'OPTIONAL',
  CONDITIONAL = 'CONDITIONAL',
}

/** Canonical filing stage codes shared across program document specs. */
export type FilingStageCode =
  | 'PRE_APPLICATION'
  | 'INITIAL_CLAIM'
  | 'FINAL_CLAIM'
  | 'AUDIT';

export const FILING_STAGE_CODES: readonly FilingStageCode[] = [
  'PRE_APPLICATION',
  'INITIAL_CLAIM',
  'FINAL_CLAIM',
  'AUDIT',
] as const;

export const DOCUMENT_REQUIREMENT_LEVELS: readonly DocumentRequirementLevel[] = [
  DocumentRequirementLevel.REQUIRED,
  DocumentRequirementLevel.OPTIONAL,
  DocumentRequirementLevel.CONDITIONAL,
] as const;

/**
 * Predicate evaluated at runtime (Phase 2+) to determine whether a
 * CONDITIONAL document applies to a given project.
 */
export type DocumentCondition =
  | { kind: 'hasBroadcasterCommitment'; description?: string }
  | { kind: 'formatIn'; formats: string[]; description?: string };

/** Ordered filing milestone for a program's application lifecycle. */
export interface FilingStage {
  stageCode: FilingStageCode;
  label: string;
  order: number;
  description?: string;
}

/**
 * A single document obligation declared by a program's document spec.
 *
 * `category` maps to the existing `DocumentCategory` enum on uploaded
 * `Document` records for auto-fulfillment detection in later phases.
 */
export interface DocumentRequirement {
  documentCode: string;
  label: string;
  stageCode: FilingStageCode;
  level: DocumentRequirementLevel;
  /** Maps to Document.category for fulfillment matching. */
  category?: DocumentCategory;
  condition?: DocumentCondition;
  /** Accepted file formats, e.g. ['PDF', 'XLSX']. */
  formats?: string[];
  /** Link to official agency form or template. */
  templateUrl?: string;
  notes?: string;
}

/**
 * Declarative document requirements for a single incentive program.
 * Registry-driven program policy — not stored in the database.
 */
export interface ProgramDocumentSpec {
  programCode: string;
  agencyCode: string;
  agencyName: string;
  filingStages: FilingStage[];
  documents: DocumentRequirement[];
}
