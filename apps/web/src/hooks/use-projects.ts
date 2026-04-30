'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
  metadata?: { logline?: string } | null;
  format?: { formatType?: string } | null;
}

/** Fetches projects for the current org. Pass null to skip fetching (e.g. when no org selected). */
export function useProjects(orgId: string | null) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const list = (await apiClient.get<ProjectSummary[]>('/projects')) ?? [];
      setProjects(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      setProjects([]);
      return;
    }
    setIsLoading(true);
    fetchProjects();
  }, [orgId, fetchProjects]);

  return { projects, isLoading, error, refetch: fetchProjects };
}
