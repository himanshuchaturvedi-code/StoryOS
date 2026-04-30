'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VendorEligibility {
  id: string;
  vendorId: string;
  programCode: string;
  status: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'UNDER_REVIEW' | 'EXPIRED';
  effectiveFrom: string;
  effectiveTo: string | null;
  certificationRef: string | null;
  notes: string | null;
}

export interface Vendor {
  id: string;
  organizationId: string;
  name: string;
  vendorType: string;
  legalName: string | null;
  registrationNum: string | null;
  country: string;
  provinceState: string | null;
  city: string | null;
  isCanadianOwned: boolean | null;
  notes: string | null;
  createdAt: string;
  eligibilities: VendorEligibility[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendors = useCallback(async () => {
    try {
      setError(null);
      const list = await apiClient.get<Vendor[]>('/vendors');
      setVendors(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vendors');
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchVendors();
  }, [fetchVendors]);

  return { vendors, isLoading, error, refetch: fetchVendors };
}
