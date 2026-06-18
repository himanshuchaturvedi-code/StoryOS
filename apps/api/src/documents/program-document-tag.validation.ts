import { BadRequestException } from '@nestjs/common';

import { PROGRAM_DOCUMENT_SPECS } from '../grants/program-document-specs';

export interface ProgramDocumentTag {
  programCode: string | null;
  programDocumentCode: string | null;
}

function isProvided(value: string | null | undefined): value is string {
  return value != null && value.trim() !== '';
}

/**
 * Validates paired program document tags against PROGRAM_DOCUMENT_SPECS.
 * Both fields must be null/omitted together, or both non-null together.
 */
export function assertValidProgramDocumentTag(
  programCode: string | null | undefined,
  programDocumentCode: string | null | undefined,
): ProgramDocumentTag {
  const hasProgram = isProvided(programCode);
  const hasDocument = isProvided(programDocumentCode);

  if (!hasProgram && !hasDocument) {
    return { programCode: null, programDocumentCode: null };
  }

  if (hasProgram !== hasDocument) {
    throw new BadRequestException(
      'programCode and programDocumentCode must both be provided or both omitted',
    );
  }

  const normalizedProgramCode = programCode!.trim();
  const normalizedDocumentCode = programDocumentCode!.trim();
  const spec = PROGRAM_DOCUMENT_SPECS.get(normalizedProgramCode);
  if (!spec) {
    throw new BadRequestException(`Unknown programCode: ${normalizedProgramCode}`);
  }

  const requirement = spec.documents.find(
    (entry) => entry.documentCode === normalizedDocumentCode,
  );
  if (!requirement) {
    throw new BadRequestException(
      `Unknown programDocumentCode ${normalizedDocumentCode} for program ${normalizedProgramCode}`,
    );
  }

  return {
    programCode: normalizedProgramCode,
    programDocumentCode: normalizedDocumentCode,
  };
}

export function resolveProgramDocumentTag(
  existing: ProgramDocumentTag,
  update: {
    programCode?: string | null;
    programDocumentCode?: string | null;
  },
): ProgramDocumentTag {
  const programCode =
    update.programCode !== undefined ? update.programCode : existing.programCode;
  const programDocumentCode =
    update.programDocumentCode !== undefined
      ? update.programDocumentCode
      : existing.programDocumentCode;

  return assertValidProgramDocumentTag(programCode, programDocumentCode);
}
