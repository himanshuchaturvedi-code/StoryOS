'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BudgetVersionSummary {
  id: string;
  versionNumber: number;
  name: string;
  status: 'DRAFT' | 'LOCKED';
}

export interface Budget {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  baseCurrency: string;
  createdAt: string;
  versions: BudgetVersionSummary[];
}

export interface BudgetAccount {
  id: string;
  budgetId: string;
  code: string;
  name: string;
  accountType: string | null;
  isHeader: boolean;
  sortOrder: number;
  parentId: string | null;
}

export interface BudgetLine {
  id: string;
  budgetVersionId: string;
  budgetAccountId: string;
  description: string | null;
  quantity: number | null;
  unitCost: number | null;
  amount: number;
  currency: string;
  fringeRate: number | null;
  notes: string | null;
  personId: string | null;
  vendorId: string | null;
  locationId: string | null;
  productionPhaseId: string | null;
  labourAmount: number | null;
  expenseType: string | null;
  activityType: string | null;
  isServiceContract: boolean | null;
  sortOrder: number;
  account: { id: string; code: string; name: string; accountType: string | null };
}

export interface AnnotationCompleteness {
  total: number;
  annotated: number;
  percentage: number;
}

export interface BudgetVersionAccount {
  id: string;
  code: string;
  name: string;
  accountType: string | null;
  isHeader: boolean;
  sortOrder: number;
  parentId: string | null;
}

export interface BudgetVersion {
  id: string;
  budgetId: string;
  versionNumber: number;
  name: string;
  status: 'DRAFT' | 'LOCKED';
  notes: string | null;
  lockedAt: string | null;
  lines: BudgetLine[];
  accounts: BudgetVersionAccount[];
}

export interface ReconciliationLine {
  accountId: string;
  code: string;
  name: string;
  accountType: string | null;
  isHeader: boolean;
  parentId: string | null;
  budgetTotal: number;
  actualTotal: number;
  variance: number;
}

export interface Reconciliation {
  budgetId: string;
  versionId: string;
  lines: ReconciliationLine[];
  totals: { budgetTotal: number; actualTotal: number; variance: number };
}

// ── Budgets Hook ─────────────────────────────────────────────────────────────

export function useBudgets(projectId: string | null) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = await apiClient.get<Budget[]>(`/projects/${projectId}/budgets`);
      setBudgets(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load budgets');
      setBudgets([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setBudgets([]); return; }
    setIsLoading(true);
    fetchBudgets();
  }, [projectId, fetchBudgets]);

  return { budgets, isLoading, error, refetch: fetchBudgets };
}

// ── Budget Version Hook ──────────────────────────────────────────────────────

export function useBudgetVersion(budgetId: string | null, versionId: string | null) {
  const [version, setVersion] = useState<BudgetVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersion = useCallback(async () => {
    if (!budgetId || !versionId) { setIsLoading(false); return; }
    try {
      setError(null);
      const v = await apiClient.get<BudgetVersion>(
        `/budgets/${budgetId}/versions/${versionId}`,
      );
      setVersion(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load version');
      setVersion(null);
    } finally {
      setIsLoading(false);
    }
  }, [budgetId, versionId]);

  useEffect(() => {
    if (!budgetId || !versionId) { setIsLoading(false); setVersion(null); return; }
    setIsLoading(true);
    fetchVersion();
  }, [budgetId, versionId, fetchVersion]);

  return { version, isLoading, error, refetch: fetchVersion };
}

// ── Reconciliation Hook ──────────────────────────────────────────────────────

export function useReconciliation(budgetId: string | null, versionId: string | null) {
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!budgetId || !versionId) return;
    setIsLoading(true);
    try {
      setError(null);
      const r = await apiClient.get<Reconciliation>(
        `/budgets/${budgetId}/actuals/reconciliation?versionId=${versionId}`,
      );
      setReconciliation(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation');
    } finally {
      setIsLoading(false);
    }
  }, [budgetId, versionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { reconciliation, isLoading, error, refetch: fetch };
}

// ── Annotation Completeness (Phase 5) ─────────────────────────────────────────

export function useAnnotationCompleteness(
  budgetId: string | null,
  versionId: string | null,
) {
  const [completeness, setCompleteness] = useState<AnnotationCompleteness | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!budgetId || !versionId) return;
    setIsLoading(true);
    try {
      setError(null);
      const data = await apiClient.get<AnnotationCompleteness>(
        `/budgets/${budgetId}/versions/${versionId}/lines/annotation-completeness`,
      );
      setCompleteness(data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load completeness');
      setCompleteness(null);
    } finally {
      setIsLoading(false);
    }
  }, [budgetId, versionId]);

  useEffect(() => {
    if (!budgetId || !versionId) {
      setCompleteness(null);
      return;
    }
    fetch();
  }, [fetch, budgetId, versionId]);

  return { completeness, isLoading, error, refetch: fetch };
}
