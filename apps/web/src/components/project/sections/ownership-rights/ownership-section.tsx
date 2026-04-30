'use client';

import { useState } from 'react';
import { useProjectOwnerships, type ProjectOwnership } from '@/hooks/use-phase3';
import { apiClient } from '@/lib/api-client';

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }
function fmtPct(n: number) { return `${Number(n).toFixed(1)}%`; }

const PROVINCE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'AB', label: 'AB — Alberta' },
  { value: 'BC', label: 'BC — British Columbia' },
  { value: 'MB', label: 'MB — Manitoba' },
  { value: 'NB', label: 'NB — New Brunswick' },
  { value: 'NL', label: 'NL — Newfoundland and Labrador' },
  { value: 'NS', label: 'NS — Nova Scotia' },
  { value: 'NT', label: 'NT — Northwest Territories' },
  { value: 'NU', label: 'NU — Nunavut' },
  { value: 'ON', label: 'ON — Ontario' },
  { value: 'PE', label: 'PE — Prince Edward Island' },
  { value: 'QC', label: 'QC — Quebec' },
  { value: 'SK', label: 'SK — Saskatchewan' },
  { value: 'YT', label: 'YT — Yukon' },
];

interface OwnershipFormState {
  entityName: string;
  entityCountry: string;
  entityProvinceState: string;
  ownershipPercentage: string;
  isProducer: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
}

const emptyForm: OwnershipFormState = {
  entityName: '', entityCountry: 'CA', entityProvinceState: '',
  ownershipPercentage: '', isProducer: false, effectiveFrom: '', effectiveTo: '', notes: '',
};

function OwnershipRow({ item, projectId, onRefresh }: { item: ProjectOwnership; projectId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OwnershipFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setForm({
      entityName: item.entityName,
      entityCountry: item.entityCountry,
      entityProvinceState: item.entityProvinceState ?? '',
      ownershipPercentage: String(item.ownershipPercentage),
      isProducer: item.isProducer,
      effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
      effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
      notes: item.notes ?? '',
    });
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditError(null); };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.isProducer && !form.entityProvinceState) {
      setEditError('Province is required when entity is a Producer.');
      return;
    }
    setSaving(true); setEditError(null);
    try {
      await apiClient.patch(`/projects/${projectId}/ownerships/${item.id}`, {
        entityName: form.entityName,
        entityCountry: form.entityCountry,
        entityProvinceState: form.entityProvinceState || null,
        ownershipPercentage: parseFloat(form.ownershipPercentage),
        isProducer: form.isProducer,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
      });
      setEditing(false);
      await onRefresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this ownership record?')) return;
    await apiClient.delete(`/projects/${projectId}/ownerships/${item.id}`);
    onRefresh();
  };

  if (editing) {
    return (
      <tr className="border-t border-gray-100 bg-blue-50/30">
        <td colSpan={8} className="px-4 py-3">
          <form onSubmit={saveEdit} className="space-y-3">
            {editError && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{editError}</div>}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Entity Name *</label>
                <input value={form.entityName} onChange={(e) => setForm({ ...form, entityName: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
                <input value={form.entityCountry} onChange={(e) => setForm({ ...form, entityCountry: e.target.value })} maxLength={2} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Province {form.isProducer ? '*' : ''}</label>
                <select value={form.entityProvinceState} onChange={(e) => setForm({ ...form, entityProvinceState: e.target.value })} required={form.isProducer} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none">
                  {PROVINCE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ownership % *</label>
                <input type="number" step="0.01" min="0" max="100" value={form.ownershipPercentage} onChange={(e) => setForm({ ...form, ownershipPercentage: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective From *</label>
                <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective To</label>
                <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.isProducer} onChange={(e) => setForm({ ...form, isProducer: e.target.checked })} className="rounded" />
                  Producer
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={cancelEdit} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-2 text-sm font-medium text-gray-800">{item.entityName}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{item.entityCountry}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{item.entityProvinceState || '—'}</td>
      <td className="px-3 py-2 text-right font-mono text-sm text-gray-800">{fmtPct(item.ownershipPercentage)}</td>
      <td className="px-3 py-2">
        {item.isProducer && (
          <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">Producer</span>
        )}
        {item.isProducer && !item.entityProvinceState && (
          <span className="ml-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title="Province required for FTTC elevated tier">Missing Province</span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(item.effectiveFrom)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(item.effectiveTo) || 'Current'}</td>
      <td className="px-3 py-2 text-right space-x-2">
        <button onClick={startEdit} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
        <button onClick={remove} className="text-xs text-red-400 hover:text-red-600">Delete</button>
      </td>
    </tr>
  );
}

interface ProjectSectionProps {
  projectId: string;
}

export function OwnershipSection({ projectId }: ProjectSectionProps) {
  const { ownerships, isLoading, error, refetch } = useProjectOwnerships(projectId);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<OwnershipFormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const totalPct = ownerships.reduce((s, o) => s + Number(o.ownershipPercentage), 0);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.isProducer && !form.entityProvinceState) {
      setFormError('Province is required when entity is a Producer.');
      return;
    }
    setSaving(true); setFormError(null);
    try {
      await apiClient.post(`/projects/${projectId}/ownerships`, {
        entityName: form.entityName,
        entityCountry: form.entityCountry,
        entityProvinceState: form.entityProvinceState || null,
        ownershipPercentage: parseFloat(form.ownershipPercentage),
        isProducer: form.isProducer,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        notes: form.notes || null,
      });
      setForm({ ...emptyForm });
      setShowAdd(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to add ownership record');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading ownership records...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Project Ownership</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track equity participants in this production. Used for Canadian-control tests.
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Owner
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showAdd && (
        <form onSubmit={add} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-800">New Ownership Record</h3>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entity Name *</label>
              <input value={form.entityName} onChange={(e) => setForm({ ...form, entityName: e.target.value })} required placeholder="e.g. Maple Productions Inc." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
              <input value={form.entityCountry} onChange={(e) => setForm({ ...form, entityCountry: e.target.value })} placeholder="CA" maxLength={2} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Province {form.isProducer ? '*' : ''}</label>
              <select value={form.entityProvinceState} onChange={(e) => setForm({ ...form, entityProvinceState: e.target.value })} required={form.isProducer} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                {PROVINCE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ownership % *</label>
              <input type="number" step="0.01" min="0" max="100" value={form.ownershipPercentage} onChange={(e) => setForm({ ...form, ownershipPercentage: e.target.value })} required placeholder="e.g. 51.00" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective From *</label>
              <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective To</label>
              <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isProducer} onChange={(e) => setForm({ ...form, isProducer: e.target.checked })} className="rounded" />
                Identified as Producer
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Owner'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {ownerships.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No ownership records yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Entity</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Country</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Province</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Ownership %</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Role</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">From</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">To</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {ownerships.map((o) => <OwnershipRow key={o.id} item={o} projectId={projectId} onRefresh={refetch} />)}
              <tr className="border-t-2 border-gray-300">
                <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-700">Total (current records)</td>
                <td className={`px-3 py-2 text-right font-mono text-sm font-semibold ${totalPct > 100 ? 'text-red-600' : 'text-gray-900'}`}>{fmtPct(totalPct)}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
          {totalPct > 100 && (
            <p className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600">
              Total ownership exceeds 100%. Review records for overlapping effective dates.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
