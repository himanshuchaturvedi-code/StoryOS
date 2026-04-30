'use client';

import { useState } from 'react';
import { useVendors, type Vendor, type VendorEligibility } from '@/hooks/use-vendors';
import { apiClient } from '@/lib/api-client';
import { VendorType, EligibilityStatus } from '@storyos/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VENDOR_TYPE_LABELS: Record<string, string> = {
  PRODUCTION_SERVICE: 'Production Service',
  POST_PRODUCTION: 'Post-Production',
  VFX: 'VFX',
  ANIMATION: 'Animation',
  SOUND: 'Sound',
  MUSIC: 'Music',
  EQUIPMENT_RENTAL: 'Equipment Rental',
  STUDIO_RENTAL: 'Studio Rental',
  CATERING: 'Catering',
  TRANSPORTATION: 'Transportation',
  INSURANCE: 'Insurance',
  LEGAL: 'Legal',
  OTHER: 'Other',
};

const ELIGIBILITY_COLORS: Record<string, string> = {
  ELIGIBLE: 'bg-green-100 text-green-700',
  NOT_ELIGIBLE: 'bg-red-100 text-red-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA');
}

// ── Eligibility Row ───────────────────────────────────────────────────────────

function EligibilityRow({
  elig,
  vendorId,
  onRefresh,
}: {
  elig: VendorEligibility;
  vendorId: string;
  onRefresh: () => void;
}) {
  const remove = async () => {
    if (!confirm('Remove this eligibility record?')) return;
    await apiClient.delete(`/vendors/${vendorId}/eligibilities/${elig.id}`);
    onRefresh();
  };

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-2 text-sm font-mono text-gray-700">{elig.programCode}</td>
      <td className="px-3 py-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ELIGIBILITY_COLORS[elig.status] ?? ''}`}>
          {elig.status}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(elig.effectiveFrom)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(elig.effectiveTo) || 'Current'}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{elig.certificationRef ?? '—'}</td>
      <td className="px-3 py-2 text-right">
        <button onClick={remove} className="text-xs text-red-400 hover:text-red-600">Remove</button>
      </td>
    </tr>
  );
}

// ── Vendor Card ───────────────────────────────────────────────────────────────

function VendorCard({ vendor, onRefresh, onDelete }: { vendor: Vendor; onRefresh: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddElig, setShowAddElig] = useState(false);
  const [eligForm, setEligForm] = useState({
    programCode: '',
    status: EligibilityStatus.UNDER_REVIEW as string,
    effectiveFrom: '',
    effectiveTo: '',
    certificationRef: '',
  });
  const [saving, setSaving] = useState(false);

  const addEligibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post(`/vendors/${vendor.id}/eligibilities`, {
        programCode: eligForm.programCode,
        status: eligForm.status,
        effectiveFrom: eligForm.effectiveFrom,
        effectiveTo: eligForm.effectiveTo || null,
        certificationRef: eligForm.certificationRef || null,
      });
      setEligForm({ programCode: '', status: EligibilityStatus.UNDER_REVIEW, effectiveFrom: '', effectiveTo: '', certificationRef: '' });
      setShowAddElig(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-gray-50/40"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{vendor.name}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {VENDOR_TYPE_LABELS[vendor.vendorType] ?? vendor.vendorType}
          </span>
          {vendor.isCanadianOwned && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">CA-owned</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {vendor.city ? `${vendor.city}, ` : ''}{vendor.country}
          </span>
          <span className="text-xs text-gray-400">
            {vendor.eligibilities.length} eligibility record{vendor.eligibilities.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Delete
          </button>
          <span className="text-gray-300">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {vendor.eligibilities.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No eligibility records.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Program Code</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">From</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">To</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">Ref</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {vendor.eligibilities.map((e) => (
                  <EligibilityRow key={e.id} elig={e} vendorId={vendor.id} onRefresh={onRefresh} />
                ))}
              </tbody>
            </table>
          )}

          {showAddElig ? (
            <form onSubmit={addEligibility} className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Program Code *</label>
                  <input
                    value={eligForm.programCode}
                    onChange={(e) => setEligForm({ ...eligForm, programCode: e.target.value })}
                    placeholder="e.g. CAVCO"
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={eligForm.status}
                    onChange={(e) => setEligForm({ ...eligForm, status: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  >
                    {Object.values(EligibilityStatus).map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={eligForm.effectiveFrom}
                    onChange={(e) => setEligForm({ ...eligForm, effectiveFrom: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective To</label>
                  <input
                    type="date"
                    value={eligForm.effectiveTo}
                    onChange={(e) => setEligForm({ ...eligForm, effectiveTo: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Certification Ref</label>
                  <input
                    value={eligForm.certificationRef}
                    onChange={(e) => setEligForm({ ...eligForm, certificationRef: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Record'}
                </button>
                <button type="button" onClick={() => setShowAddElig(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t border-gray-100 px-5 py-3">
              <button onClick={() => setShowAddElig(true)} className="text-sm text-brand-600 hover:text-brand-800">
                + Add eligibility record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { vendors, isLoading, error, refetch } = useVendors();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    vendorType: VendorType.PRODUCTION_SERVICE as string,
    legalName: '',
    country: 'CA',
    provinceState: '',
    city: '',
    isCanadianOwned: false,
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      await apiClient.post('/vendors', {
        name: form.name.trim(),
        vendorType: form.vendorType,
        legalName: form.legalName || null,
        country: form.country,
        provinceState: form.provinceState || null,
        city: form.city || null,
        isCanadianOwned: form.isCanadianOwned,
      });
      setForm({ name: '', vendorType: VendorType.PRODUCTION_SERVICE, legalName: '', country: 'CA', provinceState: '', city: '', isCanadianOwned: false });
      setShowNew(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create vendor');
    } finally {
      setCreating(false);
    }
  };

  const deleteVendor = async (id: string) => {
    if (!confirm('Delete this vendor?')) return;
    try {
      await apiClient.delete(`/vendors/${id}`);
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete vendor');
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading vendors...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Vendor Library</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage vendors and their program eligibility records used across your productions.
          </p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add Vendor
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showNew && (
        <form onSubmit={createVendor} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-800">New Vendor</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Vendor name" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                {Object.values(VendorType).map((t) => (
                  <option key={t} value={t}>{VENDOR_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="CA" maxLength={2} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Province / State</label>
              <input value={form.provinceState} onChange={(e) => setForm({ ...form, provinceState: e.target.value })} placeholder="e.g. ON" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Toronto" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Legal Name</label>
              <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="Optional full legal name" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.isCanadianOwned} onChange={(e) => setForm({ ...form, isCanadianOwned: e.target.checked })} className="rounded" />
            Canadian-owned (preliminary flag)
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {creating ? 'Saving...' : 'Add Vendor'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {vendors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No vendors yet. Add your first vendor above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <VendorCard key={v.id} vendor={v} onRefresh={refetch} onDelete={() => deleteVendor(v.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
