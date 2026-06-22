export interface AmpgSpendSummaryFileNameParams {
  projectTitle: string;
  generatedAt?: Date;
}

export interface AmpgSpendSummaryDocumentTitleParams {
  projectTitle: string;
}

function sanitizeFileSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function buildAmpgSpendSummaryFileName({
  projectTitle,
  generatedAt = new Date(),
}: AmpgSpendSummaryFileNameParams): string {
  return `AMPG_AB_SPEND_${sanitizeFileSegment(projectTitle)}_${dateStamp(generatedAt)}.pdf`;
}

export function buildAmpgSpendSummaryDocumentTitle({
  projectTitle,
}: AmpgSpendSummaryDocumentTitleParams): string {
  return `AMPG Alberta Spend Summary — ${projectTitle}`;
}
