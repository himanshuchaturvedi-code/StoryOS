export interface AmpgLabourSummaryFileNameParams {
  projectTitle: string;
  generatedAt?: Date;
}

export interface AmpgLabourSummaryDocumentTitleParams {
  projectTitle: string;
}

function sanitizeFileSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function buildAmpgLabourSummaryFileName({
  projectTitle,
  generatedAt = new Date(),
}: AmpgLabourSummaryFileNameParams): string {
  return `AMPG_AB_LABOUR_${sanitizeFileSegment(projectTitle)}_${dateStamp(generatedAt)}.pdf`;
}

export function buildAmpgLabourSummaryDocumentTitle({
  projectTitle,
}: AmpgLabourSummaryDocumentTitleParams): string {
  return `AMPG Alberta Labour Summary — ${projectTitle}`;
}

export const AMPG_LABOUR_SUMMARY_DISCLAIMER =
  'Generated support summary only — not a substitute for signed Alberta Residency Confirmation forms.';
