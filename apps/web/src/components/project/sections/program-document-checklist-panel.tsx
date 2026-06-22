'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  AMPG_LABOUR_SUMMARY_DOCUMENT_CODE,
  AMPG_SPEND_SUMMARY_DOCUMENT_CODE,
  generateAmpgAbLabourSummary,
  generateAmpgAbSpendSummary,
  type DocumentGenerationWarning,
} from '@/lib/generate-ampg-document';
import {
  CPTC_BOC_DOCUMENT_CODE,
  generateCptcPartA,
} from '@/lib/generate-cptc-part-a';
import { Button } from '@storyos/ui';
import {
  DOCUMENT_CHECKLIST_PROGRAM_CODES,
  normalizeChecklistProgramCode,
  type ChecklistProgramRef,
} from './extract-checklist-programs';

type DocumentChecklistItemStatus =
  | 'FULFILLED'
  | 'MISSING'
  | 'AMBIGUOUS'
  | 'NOT_APPLICABLE';

interface DocumentChecklistItem {
  documentCode: string;
  label: string;
  level: string;
  stageCode: string;
  category?: string;
  status: DocumentChecklistItemStatus;
  matchedDocumentIds: string[];
  fulfillmentSource: string;
  warning?: string;
}

interface DocumentChecklistStageGroup {
  stageCode: string;
  label: string;
  order: number;
  documents: DocumentChecklistItem[];
}

interface DocumentChecklistResponse {
  programCode: string;
  agencyName: string;
  filingStages: Array<{
    stageCode: string;
    label: string;
    order: number;
    description?: string;
  }>;
  stages: DocumentChecklistStageGroup[];
  requiredCount: number;
  fulfilledRequiredCount: number;
  missingRequiredCount: number;
  warnings: string[];
}

interface ProgramDocumentChecklistPanelProps {
  projectId: string;
  programs: ChecklistProgramRef[];
  /** When true, CPTC applications can generate CAVCO Part A from the checklist. */
  enableCptcGeneration?: boolean;
  /** When true, AMPG applications can generate Alberta summaries from the checklist. */
  enableAmpgGeneration?: boolean;
}

function statusBadgeClass(status: DocumentChecklistItemStatus) {
  switch (status) {
    case 'FULFILLED':
      return 'bg-green-100 text-green-700';
    case 'MISSING':
      return 'bg-red-100 text-red-700';
    case 'AMBIGUOUS':
      return 'bg-amber-100 text-amber-800';
    case 'NOT_APPLICABLE':
      return 'bg-gray-100 text-gray-500';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function statusLabel(status: DocumentChecklistItemStatus) {
  switch (status) {
    case 'FULFILLED':
      return 'Fulfilled';
    case 'MISSING':
      return 'Missing';
    case 'AMBIGUOUS':
      return 'Ambiguous';
    case 'NOT_APPLICABLE':
      return 'Not applicable';
    default:
      return status;
  }
}

function levelLabel(level: string) {
  if (level === 'REQUIRED') return 'Required';
  if (level === 'OPTIONAL') return 'Optional';
  if (level === 'CONDITIONAL') return 'Conditional';
  return level;
}

/** Hide internal documentCode-in-notes matching guidance from pilot users. */
function sanitizeWarning(warning: string): string | null {
  const lower = warning.toLowerCase();
  if (lower.includes('documentcode') || lower.includes('document.notes')) {
    if (lower.includes('documentcategory.other') || lower.includes('share documentcategory')) {
      return 'Several required documents share a generic upload category. Add distinct uploads from the Documents tab for each requirement.';
    }
    if (lower.includes('category-only matching')) {
      return 'Some documents are matched by category only, which may be imprecise when multiple requirements share the same type.';
    }
    return null;
  }
  return warning;
}

function collectSanitizedWarnings(checklist: DocumentChecklistResponse): string[] {
  const warnings = new Set<string>();
  for (const warning of checklist.warnings) {
    const sanitized = sanitizeWarning(warning);
    if (sanitized) warnings.add(sanitized);
  }
  for (const stage of checklist.stages) {
    for (const doc of stage.documents) {
      if (!doc.warning) continue;
      const sanitized = sanitizeWarning(doc.warning);
      if (sanitized) warnings.add(sanitized);
    }
  }
  return [...warnings];
}

function warningSeverityClass(severity: DocumentGenerationWarning['severity']) {
  if (severity === 'error') return 'text-red-800';
  if (severity === 'info') return 'text-blue-800';
  return 'text-amber-900';
}

function checklistHelpText(
  enableCptcGeneration: boolean,
  enableAmpgGeneration: boolean,
): string {
  if (enableCptcGeneration) {
    return 'Upload documents from the Documents tab, or generate CAVCO Part A Breakdown of Costs from a locked budget.';
  }
  if (enableAmpgGeneration) {
    return 'Upload documents from the Documents tab, or generate Alberta Spend / Labour summaries from a locked budget.';
  }
  return 'Upload documents from the Documents tab; matching is based on document type and project uploads.';
}

function ProgramChecklistCard({
  checklist,
  programName,
  enableCptcGeneration,
  enableAmpgGeneration,
  generatingDocumentCode,
  onGenerateDocument,
}: {
  checklist: DocumentChecklistResponse;
  programName: string;
  enableCptcGeneration: boolean;
  enableAmpgGeneration: boolean;
  generatingDocumentCode: string | null;
  onGenerateDocument?: (documentCode: string) => void;
}) {
  const warnings = collectSanitizedWarnings(checklist);
  const stagesWithDocs = checklist.stages.filter((stage) => stage.documents.length > 0);
  const canGenerateCptc =
    enableCptcGeneration && checklist.programCode === 'CPTC' && onGenerateDocument;
  const canGenerateAmpg =
    enableAmpgGeneration && checklist.programCode === 'AMPG' && onGenerateDocument;

  return (
    <article className="rounded-md border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-medium text-gray-900">{programName}</h4>
          <p className="text-xs text-gray-500">
            {checklist.programCode} · {checklist.agencyName}
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-gray-900">
            {checklist.fulfilledRequiredCount} / {checklist.requiredCount} required
          </div>
          <div className="text-xs text-gray-500">
            {checklist.missingRequiredCount} missing
          </div>
        </div>
      </div>

      {checklist.requiredCount > 0 && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{
              width: `${Math.round(
                (checklist.fulfilledRequiredCount / checklist.requiredCount) * 100,
              )}%`,
            }}
          />
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-4">
        {stagesWithDocs.map((stage) => (
          <div key={stage.stageCode}>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {stage.label}
            </h5>
            <ul className="mt-2 space-y-1.5">
              {[...stage.documents]
                .sort((a, b) => {
                  if (a.status === 'MISSING' && b.status !== 'MISSING') return -1;
                  if (a.status !== 'MISSING' && b.status === 'MISSING') return 1;
                  return 0;
                })
                .map((doc) => {
                  const showGenerate =
                    (canGenerateCptc && doc.documentCode === CPTC_BOC_DOCUMENT_CODE) ||
                    (canGenerateAmpg &&
                      (doc.documentCode === AMPG_SPEND_SUMMARY_DOCUMENT_CODE ||
                        doc.documentCode === AMPG_LABOUR_SUMMARY_DOCUMENT_CODE));
                  const isGeneratingThisDoc = generatingDocumentCode === doc.documentCode;
                  const isGeneratingOtherDoc =
                    generatingDocumentCode != null && !isGeneratingThisDoc;

                  return (
                    <li
                      key={doc.documentCode}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 bg-white px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-gray-900">{doc.label}</div>
                        <div className="text-xs text-gray-400">{levelLabel(doc.level)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {showGenerate && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isGeneratingOtherDoc || isGeneratingThisDoc}
                            onClick={() => onGenerateDocument?.(doc.documentCode)}
                          >
                            {isGeneratingThisDoc ? 'Generating…' : 'Generate'}
                          </Button>
                        )}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(doc.status)}`}
                        >
                          {statusLabel(doc.status)}
                        </span>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ProgramDocumentChecklistPanel({
  projectId,
  programs,
  enableCptcGeneration = false,
  enableAmpgGeneration = false,
}: ProgramDocumentChecklistPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [checklists, setChecklists] = useState<
    Record<string, DocumentChecklistResponse | null>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingDocumentCode, setGeneratingDocumentCode] = useState<string | null>(
    null,
  );
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generationWarnings, setGenerationWarnings] = useState<
    DocumentGenerationWarning[] | null
  >(null);
  const [lastGeneratedFileName, setLastGeneratedFileName] = useState<string | null>(
    null,
  );

  const applicablePrograms = useMemo(
    () =>
      programs.flatMap((program) => {
        const code = normalizeChecklistProgramCode(program.programCode);
        if (!code) return [];
        return [
          {
            programCode: code,
            programName: program.programName?.trim() || code,
          },
        ];
      }),
    [programs],
  );

  const programCodesKey = useMemo(
    () => applicablePrograms.map((program) => program.programCode).sort().join(','),
    [applicablePrograms],
  );

  const loadChecklists = useCallback(async () => {
    if (!programCodesKey) {
      setChecklists({});
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        applicablePrograms.map(async (program) => {
          try {
            const checklist = await apiClient.get<DocumentChecklistResponse>(
              `/projects/${projectId}/programs/by-code/${program.programCode}/document-checklist`,
            );
            return [program.programCode, checklist] as const;
          } catch {
            return [program.programCode, null] as const;
          }
        }),
      );
      setChecklists(Object.fromEntries(entries));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load application documents',
      );
    } finally {
      setIsLoading(false);
    }
  }, [applicablePrograms, programCodesKey, projectId]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  const handleGenerateDocument = useCallback(
    async (documentCode: string) => {
      setGeneratingDocumentCode(documentCode);
      setGenerateError(null);
      setGenerationWarnings(null);
      setLastGeneratedFileName(null);

      try {
        let result;
        if (documentCode === CPTC_BOC_DOCUMENT_CODE) {
          result = await generateCptcPartA(projectId);
        } else if (documentCode === AMPG_SPEND_SUMMARY_DOCUMENT_CODE) {
          result = await generateAmpgAbSpendSummary(projectId);
        } else if (documentCode === AMPG_LABOUR_SUMMARY_DOCUMENT_CODE) {
          result = await generateAmpgAbLabourSummary(projectId);
        } else {
          throw new Error(`Unsupported document code: ${documentCode}`);
        }

        setGenerationWarnings(result.warnings);
        setLastGeneratedFileName(result.fileName);
        await loadChecklists();
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : 'Failed to generate document');
      } finally {
        setGeneratingDocumentCode(null);
      }
    },
    [loadChecklists, projectId],
  );

  if (applicablePrograms.length === 0) {
    return null;
  }

  const summaryParts = applicablePrograms.map((program) => {
    const checklist = checklists[program.programCode];
    if (!checklist) return `${program.programCode}: …`;
    return `${program.programCode}: ${checklist.fulfilledRequiredCount}/${checklist.requiredCount} required`;
  });

  const canGenerateDocuments = enableCptcGeneration || enableAmpgGeneration;

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-900">
            Application Documents
          </span>
          <span className="text-xs text-gray-500">
            Required filing documents by program · {summaryParts.join(' · ')}
          </span>
        </span>
        <span className="text-sm text-gray-500">{isExpanded ? 'Hide' : 'Show'}</span>
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-gray-100 px-5 py-4">
          <p className="text-xs text-gray-500">
            {checklistHelpText(enableCptcGeneration, enableAmpgGeneration)}
          </p>

          {generateError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {generateError}
            </p>
          )}

          {lastGeneratedFileName && !generateError && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              Downloaded {lastGeneratedFileName}. Checklist refreshed.
            </p>
          )}

          {generationWarnings && generationWarnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-medium text-amber-900">Generation warnings</p>
              <ul className="mt-2 space-y-1 text-xs">
                {generationWarnings.map((warning, index) => (
                  <li
                    key={`${warning.message}-${index}`}
                    className={warningSeverityClass(warning.severity)}
                  >
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isLoading && (
            <p className="text-sm text-gray-500">Loading application document checklists…</p>
          )}

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!isLoading &&
            applicablePrograms.map((program) => {
              const checklist = checklists[program.programCode];
              if (!checklist) {
                return (
                  <div
                    key={program.programCode}
                    className="rounded-md border border-gray-100 px-4 py-3 text-sm text-gray-500"
                  >
                    {program.programName} ({program.programCode}) — checklist unavailable.
                  </div>
                );
              }
              return (
                <ProgramChecklistCard
                  key={program.programCode}
                  checklist={checklist}
                  programName={program.programName}
                  enableCptcGeneration={enableCptcGeneration}
                  enableAmpgGeneration={enableAmpgGeneration}
                  generatingDocumentCode={generatingDocumentCode}
                  onGenerateDocument={
                    canGenerateDocuments &&
                    ((enableCptcGeneration && program.programCode === 'CPTC') ||
                      (enableAmpgGeneration && program.programCode === 'AMPG'))
                      ? handleGenerateDocument
                      : undefined
                  }
                />
              );
            })}
        </div>
      )}
    </section>
  );
}

export { DOCUMENT_CHECKLIST_PROGRAM_CODES as CHECKLIST_PROGRAM_CODES };
