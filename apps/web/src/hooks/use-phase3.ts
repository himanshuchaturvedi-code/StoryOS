'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityDay {
  id: string;
  projectId: string;
  personId: string;
  roleTypeId: string;
  locationId: string;
  productionPhaseId: string | null;
  activityDate: string;
  hoursWorked: number | null;
  notes: string | null;
  person: { id: string; firstName: string; lastName: string };
  roleType: { id: string; code: string; name: string; category: string };
  location: { id: string; name: string; country: string; provinceState: string | null; zoneCode: string | null };
  productionPhase: { id: string; phaseType: string; name: string } | null;
}

export interface ResidencyStatus {
  id: string;
  personId: string;
  projectId: string;
  residencyType: string;
  country: string;
  provinceState: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  person: { id: string; firstName: string; lastName: string };
}

export interface ProjectOwnership {
  id: string;
  projectId: string;
  entityName: string;
  entityCountry: string;
  entityProvinceState: string | null;
  ownershipPercentage: number;
  isProducer: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface RightsControlFact {
  id: string;
  projectId: string;
  controlType: string;
  holderName: string;
  holderCountry: string;
  holderProvinceState: string | null;
  retentionYears: number | null;
  assertion: string;
  evidenceNotes: string | null;
  documentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  document: { id: string; title: string; storageKey: string } | null;
}

export interface ExpenseFact {
  id: string;
  projectId: string;
  actualLineId: string;
  eligiblePortion: number;
  labourFlag: boolean;
  serviceFlag: boolean;
  notes: string | null;
  actualLine: {
    id: string;
    amount: number;
    currency: string;
    description: string | null;
    vendor: string | null;
    transactionDate: string;
    budgetAccountId: string;
    budgetId: string;
  };
  vendor: { id: string; name: string; vendorType: string; country: string } | null;
  person: { id: string; firstName: string; lastName: string } | null;
  location: { id: string; name: string; country: string; provinceState: string | null; zoneCode: string | null } | null;
  productionPhase: { id: string; phaseType: string; name: string } | null;
}

export interface ExpenseFactSummary {
  projectId: string;
  totalFacts: number;
  totalAmount: number;
  eligibleAmount: number;
  labour: { count: number; eligibleAmount: number };
  service: { count: number; eligibleAmount: number };
}

// ── Activity Days ─────────────────────────────────────────────────────────────

export function useActivityDays(projectId: string | null) {
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = await apiClient.get<ActivityDay[]>(`/projects/${projectId}/activity-days`);
      setDays(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity days');
      setDays([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setDays([]); return; }
    setIsLoading(true);
    fetch();
  }, [projectId, fetch]);

  return { days, isLoading, error, refetch: fetch };
}

// ── Residency ─────────────────────────────────────────────────────────────────

export function useResidencyStatuses(projectId: string | null) {
  const [statuses, setStatuses] = useState<ResidencyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = await apiClient.get<ResidencyStatus[]>(`/projects/${projectId}/residencies`);
      setStatuses(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load residency statuses');
      setStatuses([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setStatuses([]); return; }
    setIsLoading(true);
    fetch();
  }, [projectId, fetch]);

  return { statuses, isLoading, error, refetch: fetch };
}

// ── Project Ownership ─────────────────────────────────────────────────────────

export function useProjectOwnerships(projectId: string | null) {
  const [ownerships, setOwnerships] = useState<ProjectOwnership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = await apiClient.get<ProjectOwnership[]>(`/projects/${projectId}/ownerships`);
      setOwnerships(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ownership records');
      setOwnerships([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setOwnerships([]); return; }
    setIsLoading(true);
    fetch();
  }, [projectId, fetch]);

  return { ownerships, isLoading, error, refetch: fetch };
}

// ── Rights Control ────────────────────────────────────────────────────────────

export function useRightsControlFacts(projectId: string | null) {
  const [facts, setFacts] = useState<RightsControlFact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const list = await apiClient.get<RightsControlFact[]>(`/projects/${projectId}/rights-control`);
      setFacts(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rights control facts');
      setFacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setFacts([]); return; }
    setIsLoading(true);
    fetch();
  }, [projectId, fetch]);

  return { facts, isLoading, error, refetch: fetch };
}

// ── Expense Facts ─────────────────────────────────────────────────────────────

export function useExpenseFacts(projectId: string | null) {
  const [facts, setFacts] = useState<ExpenseFact[]>([]);
  const [summary, setSummary] = useState<ExpenseFactSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) { setIsLoading(false); return; }
    try {
      setError(null);
      const [list, s] = await Promise.all([
        apiClient.get<ExpenseFact[]>(`/projects/${projectId}/expense-facts`),
        apiClient.get<ExpenseFactSummary>(`/projects/${projectId}/expense-facts/summary`),
      ]);
      setFacts(list ?? []);
      setSummary(s ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expense facts');
      setFacts([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setIsLoading(false); setFacts([]); setSummary(null); return; }
    setIsLoading(true);
    fetch();
  }, [projectId, fetch]);

  return { facts, summary, isLoading, error, refetch: fetch };
}
