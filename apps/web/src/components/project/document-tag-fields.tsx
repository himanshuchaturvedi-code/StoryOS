'use client';

import {
  TAGGABLE_PROGRAMS,
  type TaggableProgramCode,
} from '@/lib/program-document-catalog';

const selectClassName =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500';

export interface DocumentTagValue {
  programCode: string;
  programDocumentCode: string;
}

interface DocumentTagFieldsProps {
  value: DocumentTagValue;
  onChange: (value: DocumentTagValue) => void;
  disabled?: boolean;
  idPrefix?: string;
}

export function DocumentTagFields({
  value,
  onChange,
  disabled = false,
  idPrefix = 'doc-tag',
}: DocumentTagFieldsProps) {
  const selectedProgram = TAGGABLE_PROGRAMS.find(
    (program) => program.programCode === value.programCode,
  );
  const requirements = selectedProgram?.requirements ?? [];

  function handleProgramChange(nextProgramCode: string) {
    const program = TAGGABLE_PROGRAMS.find((entry) => entry.programCode === nextProgramCode);
    onChange({
      programCode: nextProgramCode,
      programDocumentCode: program?.requirements[0]?.documentCode ?? '',
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${idPrefix}-program`} className="mb-1.5 block text-sm font-medium text-gray-700">
          Program (optional)
        </label>
        <select
          id={`${idPrefix}-program`}
          value={value.programCode}
          onChange={(event) => handleProgramChange(event.target.value)}
          disabled={disabled}
          className={selectClassName}
        >
          <option value="">— None —</option>
          {TAGGABLE_PROGRAMS.map((program) => (
            <option key={program.programCode} value={program.programCode}>
              {program.programCode} — {program.programName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}-requirement`}
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Requirement (optional)
        </label>
        <select
          id={`${idPrefix}-requirement`}
          value={value.programDocumentCode}
          onChange={(event) =>
            onChange({
              programCode: value.programCode,
              programDocumentCode: event.target.value,
            })
          }
          disabled={disabled || !value.programCode}
          className={selectClassName}
        >
          <option value="">— Select requirement —</option>
          {requirements.map((requirement) => (
            <option key={requirement.documentCode} value={requirement.documentCode}>
              {requirement.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function toTagPayload(value: DocumentTagValue): {
  programCode?: string;
  programDocumentCode?: string;
} | {
  programCode: null;
  programDocumentCode: null;
} {
  if (!value.programCode || !value.programDocumentCode) {
    return { programCode: null, programDocumentCode: null };
  }
  return {
    programCode: value.programCode as TaggableProgramCode,
    programDocumentCode: value.programDocumentCode,
  };
}

export function tagValueFromDocument(document: {
  programCode?: string | null;
  programDocumentCode?: string | null;
}): DocumentTagValue {
  return {
    programCode: document.programCode ?? '',
    programDocumentCode: document.programDocumentCode ?? '',
  };
}
