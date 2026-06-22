export interface DocumentGenerationWarning {
  fieldId?: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface GenerateAmpgDocumentResult {
  fileName: string;
  documentId: string | null;
  warnings: DocumentGenerationWarning[];
}

export const AMPG_SPEND_SUMMARY_DOCUMENT_CODE = 'AB_SPEND_SUMMARY';
export const AMPG_LABOUR_SUMMARY_DOCUMENT_CODE = 'AB_LABOUR_SUMMARY';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === 'undefined') return headers;

  const token = localStorage.getItem('storyos_token');
  const orgId = localStorage.getItem('storyos_org_id');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (orgId) headers['X-Organization-Id'] = orgId;
  return headers;
}

function parseWarningsHeader(headerValue: string | null): DocumentGenerationWarning[] {
  if (!headerValue) return [];
  try {
    const parsed = JSON.parse(headerValue) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is DocumentGenerationWarning =>
        entry != null &&
        typeof entry === 'object' &&
        typeof (entry as DocumentGenerationWarning).message === 'string',
    );
  } catch {
    return [];
  }
}

async function generateAmpgDocument(
  projectId: string,
  documentType: 'AMPG_AB_SPEND_SUMMARY' | 'AMPG_AB_LABOUR_SUMMARY',
  defaultFileName: string,
): Promise<GenerateAmpgDocumentResult> {
  const response = await fetch(
    `${API_BASE}/api/projects/${projectId}/documents/generate/${documentType}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message =
      errorData && typeof errorData === 'object' && 'message' in errorData
        ? String((errorData as { message: unknown }).message)
        : `Generation failed with status ${response.status}`;
    throw new Error(message);
  }

  const warnings = parseWarningsHeader(response.headers.get('X-Document-Warnings'));
  const documentId = response.headers.get('X-Document-Id');

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  let fileName = defaultFileName;
  if (contentDisposition?.includes('filename=')) {
    fileName = contentDisposition.split('filename=')[1]!.replace(/"/g, '');
  }

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);

  return {
    fileName,
    documentId,
    warnings,
  };
}

export async function generateAmpgAbSpendSummary(
  projectId: string,
): Promise<GenerateAmpgDocumentResult> {
  return generateAmpgDocument(projectId, 'AMPG_AB_SPEND_SUMMARY', 'AMPG_AB_SPEND.pdf');
}

export async function generateAmpgAbLabourSummary(
  projectId: string,
): Promise<GenerateAmpgDocumentResult> {
  return generateAmpgDocument(
    projectId,
    'AMPG_AB_LABOUR_SUMMARY',
    'AMPG_AB_LABOUR.pdf',
  );
}
