/**
 * Typed HTTP client for all apps/web → apps/api communication.
 *
 * ARCHITECTURAL RULES:
 * 1. ALL requests to the API must go through this client.
 * 2. The client automatically attaches:
 *    - Authorization: Bearer {token} header
 *    - X-Organization-Id header (required by TenantGuard on tenant-scoped routes)
 * 3. The org ID comes from the tenant context (Phase 1B: React context or cookie).
 *    It is NEVER derived from the URL, query params, or user input directly.
 * 4. Frontend permission checks using PERMISSIONS constants are UI hints only.
 *    Server-side PermissionGuard is the authoritative enforcement point.
 *
 * Phase 1B will replace the localStorage stubs with a proper auth/tenant context.
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

// ── Token / Tenant access (Phase 1B: replace with React context) ────────────

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('storyos_token');
}

function getOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('storyos_org_id');
}

// ── Core request function ─────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiRequestOptions extends RequestInit {
  skipOrganizationHeader?: boolean;
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const orgId = getOrgId();
  const { skipOrganizationHeader, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Tenant-scoped routes require X-Organization-Id. User-scoped bootstrap
  // routes, like /organizations, must be able to run before tenant selection.
  if (orgId && !skipOrganizationHeader) {
    headers['X-Organization-Id'] = orgId;
  }

  if (path === '/grants/estimate') {
    console.info('[apiClient] POST /api/grants/estimate fetch body', fetchOptions.body);
  }

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(res.status, message, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const apiClient = {
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options }),

  post: <T>(path: string, body: unknown, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...options }),

  patch: <T>(path: string, body: unknown, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  put: <T>(path: string, body: unknown, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...options }),

  delete: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, { method: 'DELETE', ...options }),
};

export { ApiError };
