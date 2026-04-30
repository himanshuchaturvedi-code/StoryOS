'use client';

import { useState } from 'react';
import { useResidencyStatuses, type ResidencyStatus } from '@/hooks/use-phase3';
import { apiClient } from '@/lib/api-client';
import { ResidencyType } from '@storyos/types';
import { CanadianProvinceSelect } from '@/components/canadian-province-select';
import { formatProvinceStateCell } from '@/lib/province-display';

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

const RESIDENCY_LABELS: Record<string, string> = {
  CITIZEN: 'Citizen',
  PERMANENT_RESIDENT: 'Permanent Resident',
  TEMPORARY_RESIDENT: 'Temporary Resident',
  NON_RESIDENT: 'Non-Resident',
};

const RESIDENCY_COLORS: Record<string, string> = {
  CITIZEN: 'bg-green-100 text-green-700',
  PERMANENT_RESIDENT: 'bg-blue-100 text-blue-700',
  TEMPORARY_RESIDENT: 'bg-yellow-100 text-yellow-700',
  NON_RESIDENT: 'bg-gray-100 text-gray-600',
};

function StatusRow({ status, projectId, onRefresh }: { status: ResidencyStatus; projectId: string; onRefresh: () => void }) {
  const remove = async () => {
    if (!confirm('Delete this residency record?')) return;
    await apiClient.delete(`/projects/${projectId}/residencies/${status.id}`);
    onRefresh();
  };

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-2 text-sm text-gray-800">{status.person.firstName} {status.person.lastName}</td>
      <td className="px-3 py-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RESIDENCY_COLORS[status.residencyType] ?? ''}`}>
          {RESIDENCY_LABELS[status.residencyType] ?? status.residencyType}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">
        {status.country}
        {status.provinceState ? ` · ${formatProvinceStateCell(status.country, status.provinceState)}` : ''}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(status.effectiveFrom)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(status.effectiveTo) || 'Current'}</td>
      <td className="px-3 py-2 text-xs text-gray-400">{status.notes ?? '—'}</td>
      <td className="px-3 py-2 text-right">
        <button onClick={remove} className="text-xs text-red-400 hover:text-red-600">Delete</button>
      </td>
    </tr>
  );
}

interface ProjectSectionProps {
  projectId: string;
}

export function ResidencySection({ projectId }: ProjectSectionProps) {
  const { statuses, isLoading, error, refetch } = useResidencyStatuses(projectId);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    personId: '', residencyType: ResidencyType.CITIZEN as string,
    country: 'CA', provinceState: '', effectiveFrom: '', effectiveTo: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      await apiClient.post(`/projects/${projectId}/residencies`, {
        personId: form.personId,
        residencyType: form.residencyType,
        country: form.country,
        provinceState: form.provinceState || null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
      });
      setForm({ personId: '', residencyType: ResidencyType.CITIZEN, country: 'CA', provinceState: '', effectiveFrom: '', effectiveTo: '', notes: '' });
      setShowAdd(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to add residency record');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading residency records...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Participant Residency</h2>
          <p className="mt-1 text-sm text-gray-500">
            Residency is person-level and shared across projects. Evaluated at the date of service for Canadian-control and tax credit tests.
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Record
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showAdd && (
        <form onSubmit={add} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-800">New Residency Record</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Person ID *</label>
              <input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })} required placeholder="UUID" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Residency Type *</label>
              <select value={form.residencyType} onChange={(e) => setForm({ ...form, residencyType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                {Object.values(ResidencyType).map((t) => (
                  <option key={t} value={t}>{RESIDENCY_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="CA" maxLength={2} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            {form.country === 'CA' ? (
              <CanadianProvinceSelect
                value={form.provinceState}
                onChange={(code) => setForm({ ...form, provinceState: code })}
              />
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Province / State</label>
                <input
                  value={form.provinceState}
                  onChange={(e) => setForm({ ...form, provinceState: e.target.value })}
                  maxLength={10}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective From *</label>
              <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective To</label>
              <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Record'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {statuses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No residency records yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Person</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Residency</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Location</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">From</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">To</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Notes</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {statuses.map((s) => <StatusRow key={s.id} status={s} projectId={projectId} onRefresh={refetch} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
