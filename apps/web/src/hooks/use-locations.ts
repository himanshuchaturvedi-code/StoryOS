'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface Location {
  id: string;
  name: string;
  country: string;
  provinceState?: string | null;
  city?: string | null;
  locationType: string;
  incentiveRegionCode?: string | null;
  createdAt: string;
}

export interface ProjectLocation {
  id: string;
  locationId: string;
  isPrimary: boolean;
  notes?: string | null;
  location: Location;
}

export function useLocations(orgId: string | null) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!orgId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = (await apiClient.get<Location[]>('/locations')) ?? [];
      setLocations(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load locations');
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) { setIsLoading(false); setLocations([]); return; }
    setIsLoading(true);
    fetchLocations();
  }, [orgId, fetchLocations]);

  return { locations, isLoading, error, refetch: fetchLocations };
}
