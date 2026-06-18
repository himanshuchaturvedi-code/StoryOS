import type {
  DocumentRequirementLevel,
  FilingStage,
  FilingStageCode,
} from '@storyos/types';

export type DocumentChecklistItemStatus =
  | 'FULFILLED'
  | 'MISSING'
  | 'AMBIGUOUS'
  | 'NOT_APPLICABLE';

export type DocumentFulfillmentSource =
  | 'EXPLICIT_TAG'
  | 'DOCUMENT_CODE'
  | 'CATEGORY'
  | 'NONE';

export interface DocumentChecklistItem {
  documentCode: string;
  label: string;
  level: DocumentRequirementLevel;
  stageCode: FilingStageCode;
  category?: string;
  status: DocumentChecklistItemStatus;
  matchedDocumentIds: string[];
  fulfillmentSource: DocumentFulfillmentSource;
  warning?: string;
}

export interface DocumentChecklistStageGroup {
  stageCode: FilingStageCode;
  label: string;
  order: number;
  documents: DocumentChecklistItem[];
}

export interface DocumentChecklistResponse {
  programCode: string;
  agencyName: string;
  filingStages: FilingStage[];
  stages: DocumentChecklistStageGroup[];
  requiredCount: number;
  fulfilledRequiredCount: number;
  missingRequiredCount: number;
  warnings: string[];
}
