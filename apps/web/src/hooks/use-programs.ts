'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Program {
  id: string;
  code: string;
  name: string;
  scope: string;
  country: string;
  provinceState: string | null;
  administeredBy: string;
  website: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  versions: Array<{
    id: string;
    versionCode: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
}

export interface ProgramVersion {
  id: string;
  versionCode: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  description: string | null;
  sourceDocumentUrl: string | null;
  program: { id: string; code: string; name: string; scope: string; country: string };
  requirements: Array<{
    id: string;
    code: string;
    name: string;
    requirementCategory: string;
    isRequired: boolean;
    sortOrder: number;
  }>;
}

export interface ProjectProgram {
  id: string;
  projectId: string;
  programVersionId: string;
  status: string;
  targetSubmissionDate: string | null;
  notes: string | null;
  programVersion: {
    id: string;
    versionCode: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    program: { id: string; code: string; name: string; scope: string; country: string };
  };
  submissions: Array<{
    id: string;
    status: string;
    evaluationDate: string;
    submittedAt: string | null;
    createdAt: string;
  }>;
}

export interface ProgramSubmission {
  id: string;
  status: string;
  evaluationDate: string;
  budgetVersionId: string | null;
  submittedAt: string | null;
  externalRef: string | null;
  responseDate: string | null;
  notes: string | null;
  projectProgram: {
    id: string;
    programVersion: {
      id: string;
      versionCode: string;
      name: string;
      program: { id: string; code: string; name: string };
    };
  };
  evidence: Array<{ id: string; requirementId: string; evidenceType: string }>;
  assessments: Array<{
    id: string;
    requirementId: string;
    result: string;
    computedValue?: Record<string, unknown> | null;
    calculatorCode?: string | null;
    calculatorVersion?: string | null;
    isOverridden: boolean;
    overrideResult: string | null;
    isAutoAssessed: boolean;
    requirement?: { id: string; code: string; name: string; requirementCategory: string };
  }>;
}

// ── Programs (global, read-only) ──────────────────────────────────────────────

export function usePrograms(scope?: string, isActive?: boolean) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (scope) params.set('scope', scope);
      if (isActive !== undefined) params.set('isActive', String(isActive));
      const q = params.toString();
      const list = await apiClient.get<Program[]>(`/programs${q ? `?${q}` : ''}`);
      setPrograms(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load programs');
      setPrograms([]);
    } finally {
      setIsLoading(false);
    }
  }, [scope, isActive]);

  useEffect(() => {
    setIsLoading(true);
    fetch();
  }, [fetch]);

  return { programs, isLoading, error, refetch: fetch };
}

// ── Project Programs (enrollments) ─────────────────────────────────────────────

export function useProjectPrograms(projectId: string | null) {
  const [enrollments, setEnrollments] = useState<ProjectProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      setEnrollments([]);
      return;
    }
    try {
      setError(null);
      const list = await apiClient.get<ProjectProgram[]>(
        `/projects/${projectId}/programs`,
      );
      setEnrollments(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load program enrollments');
      setEnrollments([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      setEnrollments([]);
      return;
    }
    setIsLoading(true);
    fetch();
  }, [projectId, fetch]);

  return { enrollments, isLoading, error, refetch: fetch };
}
