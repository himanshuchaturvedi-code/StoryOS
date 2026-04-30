'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { apiClient } from '@/lib/api-client';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  type: string;
  createdAt: string;
  role: string;
}

interface TenantContextValue {
  orgs: OrgSummary[];
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  isLoading: boolean;
  refetchOrgs: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

const ORG_STORAGE_KEY = 'storyos_org_id';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    try {
      const list =
        (await apiClient.get<OrgSummary[]>('/organizations', {
          skipOrganizationHeader: true,
        })) ?? [];
      setOrgs(list);

      const stored = typeof window !== 'undefined' ? localStorage.getItem(ORG_STORAGE_KEY) : null;
      const validStored = list.some((o) => o.id === stored);
      if (validStored && stored) {
        setCurrentOrgIdState(stored);
      } else if (list.length > 0) {
        setCurrentOrgIdState(list[0]!.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem(ORG_STORAGE_KEY, list[0]!.id);
        }
      } else {
        setCurrentOrgIdState(null);
      }
    } catch {
      setOrgs([]);
      setCurrentOrgIdState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('storyos_token') : null;
    if (token) {
      fetchOrgs();
    } else {
      setIsLoading(false);
    }
  }, [fetchOrgs]);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORG_STORAGE_KEY, id);
    }
  }, []);

  const value: TenantContextValue = {
    orgs,
    currentOrgId,
    setCurrentOrgId,
    isLoading,
    refetchOrgs: fetchOrgs,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
