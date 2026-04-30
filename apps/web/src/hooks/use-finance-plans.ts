'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface FinanceSource {
  id: string;
  financePlanId: string;
  sourceType: string;
  name: string;
  amount: number;
  currency: string;
  status: 'ESTIMATED' | 'COMMITTED' | 'RECEIVED';
  conditions: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FinancePlan {
  id: string;
  projectId: string;
  name: string;
  baseCurrency: string;
  notes: string | null;
  createdAt: string;
  sources: FinanceSource[];
}

export interface FinanceSummary {
  planId: string;
  grandTotal: number;
  byStatus: { ESTIMATED: number; COMMITTED: number; RECEIVED: number };
  byType: Record<string, number>;
}

export function useFinancePlans(projectId: string | null) {
  const [plans, setPlans] = useState<FinancePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = await apiClient.get<FinancePlan[]>(`/projects/${projectId}/finance-plans`);
      setPlans(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load finance plans');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setPlans([]); return; }
    setIsLoading(true);
    fetchPlans();
  }, [projectId, fetchPlans]);

  return { plans, isLoading, error, refetch: fetchPlans };
}
