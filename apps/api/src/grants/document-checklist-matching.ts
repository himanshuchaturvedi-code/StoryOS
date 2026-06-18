import {
  DocumentRequirementLevel,
  type DocumentCondition,
  type DocumentRequirement,
} from '@storyos/types';

import type {
  DocumentChecklistItem,
  DocumentChecklistItemStatus,
  DocumentFulfillmentSource,
} from './document-checklist.types';

/** Upload notes convention until Document.programDocumentCode exists. */
export const DOCUMENT_CODE_NOTE_PATTERN = /\bdocumentCode=([A-Z][A-Z0-9_]*)\b/;

export interface ProjectDocumentRecord {
  id: string;
  category: string;
  notes: string | null;
}

export interface RequirementApplicabilityContext {
  hasBroadcasterCommitment: boolean;
  formatType?: string;
}

export function extractProgramDocumentCode(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(DOCUMENT_CODE_NOTE_PATTERN);
  return match?.[1] ?? null;
}

export function evaluateDocumentCondition(
  condition: DocumentCondition,
  context: RequirementApplicabilityContext,
): boolean {
  switch (condition.kind) {
    case 'hasBroadcasterCommitment':
      return context.hasBroadcasterCommitment;
    case 'formatIn':
      return (
        context.formatType != null &&
        condition.formats.includes(context.formatType)
      );
    default:
      return false;
  }
}

export function isRequirementApplicable(
  requirement: DocumentRequirement,
  context: RequirementApplicabilityContext,
): boolean {
  if (requirement.level !== DocumentRequirementLevel.CONDITIONAL) {
    return true;
  }
  if (!requirement.condition) {
    return false;
  }
  return evaluateDocumentCondition(requirement.condition, context);
}

function isRequiredLevel(level: DocumentRequirementLevel): boolean {
  return (
    level === DocumentRequirementLevel.REQUIRED ||
    level === DocumentRequirementLevel.CONDITIONAL
  );
}

function buildNotApplicableItem(
  requirement: DocumentRequirement,
  warning?: string,
): DocumentChecklistItem {
  return {
    documentCode: requirement.documentCode,
    label: requirement.label,
    level: requirement.level,
    stageCode: requirement.stageCode,
    category: requirement.category,
    status: 'NOT_APPLICABLE',
    matchedDocumentIds: [],
    fulfillmentSource: 'NONE',
    warning,
  };
}

function buildItem(
  requirement: DocumentRequirement,
  status: DocumentChecklistItemStatus,
  fulfillmentSource: DocumentFulfillmentSource,
  matchedDocumentIds: string[],
  warning?: string,
): DocumentChecklistItem {
  return {
    documentCode: requirement.documentCode,
    label: requirement.label,
    level: requirement.level,
    stageCode: requirement.stageCode,
    category: requirement.category,
    status,
    matchedDocumentIds,
    fulfillmentSource,
    warning,
  };
}

/**
 * Match program document requirements against project uploads.
 *
 * Priority:
 * 1. documentCode tag in Document.notes (`documentCode=PRODUCTION_BUDGET`)
 * 2. DocumentCategory fallback (ambiguous when shared across requirements)
 */
export function matchDocumentRequirements(args: {
  requirements: DocumentRequirement[];
  projectDocuments: ProjectDocumentRecord[];
  context: RequirementApplicabilityContext;
}): DocumentChecklistItem[] {
  const { requirements, projectDocuments, context } = args;
  const usedDocumentIds = new Set<string>();
  const items = new Map<string, DocumentChecklistItem>();

  const applicableRequirements = requirements.filter((requirement) => {
    if (!isRequirementApplicable(requirement, context)) {
      items.set(
        requirement.documentCode,
        buildNotApplicableItem(
          requirement,
          requirement.level === DocumentRequirementLevel.CONDITIONAL
            ? 'Conditional requirement not applicable to this project.'
            : undefined,
        ),
      );
      return false;
    }
    return true;
  });

  for (const requirement of applicableRequirements) {
    const codeMatches = projectDocuments.filter(
      (doc) =>
        !usedDocumentIds.has(doc.id) &&
        extractProgramDocumentCode(doc.notes) === requirement.documentCode,
    );

    if (codeMatches.length > 0) {
      for (const doc of codeMatches) {
        usedDocumentIds.add(doc.id);
      }
      items.set(
        requirement.documentCode,
        buildItem(
          requirement,
          'FULFILLED',
          'DOCUMENT_CODE',
          codeMatches.map((doc) => doc.id),
        ),
      );
    }
  }

  const pendingCategoryRequirements = applicableRequirements.filter(
    (requirement) => !items.has(requirement.documentCode),
  );

  const requirementsByCategory = new Map<string, DocumentRequirement[]>();
  for (const requirement of pendingCategoryRequirements) {
    if (!requirement.category) {
      items.set(
        requirement.documentCode,
        buildItem(requirement, 'MISSING', 'NONE', []),
      );
      continue;
    }
    const bucket = requirementsByCategory.get(requirement.category) ?? [];
    bucket.push(requirement);
    requirementsByCategory.set(requirement.category, bucket);
  }

  for (const [category, categoryRequirements] of requirementsByCategory) {
    const availableDocs = projectDocuments.filter(
      (doc) => !usedDocumentIds.has(doc.id) && doc.category === category,
    );

    if (categoryRequirements.length === 1) {
      const requirement = categoryRequirements[0]!;
      if (availableDocs.length === 0) {
        items.set(
          requirement.documentCode,
          buildItem(requirement, 'MISSING', 'NONE', []),
        );
        continue;
      }

      for (const doc of availableDocs) {
        usedDocumentIds.add(doc.id);
      }
      items.set(
        requirement.documentCode,
        buildItem(
          requirement,
          'FULFILLED',
          'CATEGORY',
          availableDocs.map((doc) => doc.id),
        ),
      );
      continue;
    }

    const sharedCategoryWarning =
      `${categoryRequirements.length} requirements share DocumentCategory.${category}; ` +
      'category matching cannot assign uploads uniquely. Tag uploads with documentCode= in notes.';

    if (availableDocs.length === 0) {
      for (const requirement of categoryRequirements) {
        items.set(
          requirement.documentCode,
          buildItem(requirement, 'MISSING', 'NONE', [], sharedCategoryWarning),
        );
      }
      continue;
    }

    for (const requirement of categoryRequirements) {
      items.set(
        requirement.documentCode,
        buildItem(
          requirement,
          'AMBIGUOUS',
          'CATEGORY',
          availableDocs.map((doc) => doc.id),
          sharedCategoryWarning,
        ),
      );
    }
  }

  return requirements.map(
    (requirement) =>
      items.get(requirement.documentCode) ??
      buildItem(requirement, 'MISSING', 'NONE', []),
  );
}

export function summarizeRequiredDocuments(items: DocumentChecklistItem[]): {
  requiredCount: number;
  fulfilledRequiredCount: number;
  missingRequiredCount: number;
} {
  const requiredItems = items.filter(
    (item) =>
      isRequiredLevel(item.level) && item.status !== 'NOT_APPLICABLE',
  );

  const fulfilledRequiredCount = requiredItems.filter(
    (item) => item.status === 'FULFILLED',
  ).length;

  const missingRequiredCount = requiredItems.filter(
    (item) => item.status === 'MISSING' || item.status === 'AMBIGUOUS',
  ).length;

  return {
    requiredCount: requiredItems.length,
    fulfilledRequiredCount,
    missingRequiredCount,
  };
}

export function collectChecklistWarnings(items: DocumentChecklistItem[]): string[] {
  const warnings = new Set<string>();
  for (const item of items) {
    if (item.warning) {
      warnings.add(item.warning);
    }
  }
  return [...warnings];
}
