export interface CptcBocFileNameParams {
  formCode: string;
  projectTitle: string;
  generatedAt?: Date;
}

export interface CptcBocDocumentTitleParams {
  formCode: string;
  formLabel: string;
  projectTitle: string;
}

function sanitizeFileSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

function dateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

export function buildCptcBocFileName({
  formCode,
  projectTitle,
  generatedAt = new Date(),
}: CptcBocFileNameParams): string {
  return `CPTC_BOC_${formCode}_${sanitizeFileSegment(projectTitle)}_${dateStamp(generatedAt)}.pdf`;
}

export function buildCptcBocDocumentTitle({
  formCode,
  formLabel,
  projectTitle,
}: CptcBocDocumentTitleParams): string {
  return `CPTC BOC ${formCode} — ${formLabel} — ${projectTitle}`;
}
