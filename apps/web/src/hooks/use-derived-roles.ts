'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { DerivedRolesResponse } from '@storyos/types';

export function useDerivedRoles(projectId: string | null, budgetVersionId: string | null) {
  const [data, setData] = useState<DerivedRolesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDerivedRoles = useCallback(async () => {
    if (!projectId || !budgetVersionId) {
      setIsLoading(false);
      setData(null);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const responseData = await apiClient.get<DerivedRolesResponse>(
        `/projects/${projectId}/derived-roles?budgetVersionId=${budgetVersionId}`
      );
      setData(responseData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load derived roles');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, budgetVersionId]);

  useEffect(() => {
    fetchDerivedRoles();
  }, [fetchDerivedRoles]);

  return { data, isLoading, error, refetch: fetchDerivedRoles };
}
