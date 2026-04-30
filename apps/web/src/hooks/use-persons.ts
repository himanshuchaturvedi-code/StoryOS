'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  citizenship?: string | null;
  city?: string | null;
  provinceState?: string | null;
  country?: string | null;
  createdAt: string;
}

export function usePersons(orgId: string | null) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPersons = useCallback(async () => {
    if (!orgId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = (await apiClient.get<Person[]>('/persons')) ?? [];
      setPersons(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load persons');
      setPersons([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) { setIsLoading(false); setPersons([]); return; }
    setIsLoading(true);
    fetchPersons();
  }, [orgId, fetchPersons]);

  return { persons, isLoading, error, refetch: fetchPersons };
}
