'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ProjectDetail {
  id: string;
  title: string;
  status: string;
  stage: string;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    logline?: string;
    synopsis?: string;
    genre?: string;
    productionYear?: number;
  } | null;
  format?: {
    formatType?: string;
    totalRuntimeMinutes?: number;
    numberOfEpisodes?: number;
  } | null;
  phases?: Array<{
    id: string;
    phaseType: string;
    name?: string;
    startDate?: string;
    endDate?: string;
  }>;
  milestones?: Array<{
    id: string;
    name: string;
    dueDate?: string;
    actualDate?: string;
  }>;
}

export function useProject(projectId: string | null) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await apiClient.get<ProjectDetail>(`/projects/${projectId}`);
      setProject(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
      setProject(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, isLoading, error, refetch: fetchProject };
}
