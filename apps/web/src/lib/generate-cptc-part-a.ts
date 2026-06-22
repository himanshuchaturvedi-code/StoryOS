export interface CptcGenerationWarning {
  fieldId?: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface GenerateCptcPartAResult {
  fileName: string;
  documentId: string | null;
  warnings: CptcGenerationWarning[];
}

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

function parseWarningsHeader(headerValue: string | null): CptcGenerationWarning[] {
  if (!headerValue) return [];
  try {
    const parsed = JSON.parse(headerValue) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CptcGenerationWarning =>
        entry != null &&
        typeof entry === 'object' &&
        typeof (entry as CptcGenerationWarning).message === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Generates CPTC Part A BOC PDF and triggers a browser download.
 * Returns generation warnings from the X-Document-Warnings response header.
 */
export async function generateCptcPartA(
  projectId: string,
): Promise<GenerateCptcPartAResult> {
  const response = await fetch(
    `${API_BASE}/api/projects/${projectId}/documents/generate/CPTC_PART_A`,
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
  let fileName = 'CPTC_Part_A.pdf';
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

export const CPTC_BOC_DOCUMENT_CODE = 'CAVCO_PART_A';
