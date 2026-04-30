'use client';

import { useState } from 'react';
import { useRightsControlFacts, type RightsControlFact } from '@/hooks/use-phase3';
import { apiClient } from '@/lib/api-client';
import { ControlType } from '@storyos/types';

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-CA') : '—'; }

const CONTROL_TYPE_LABELS: Record<string, string> = {
  CREATIVE_CONTROL: 'Creative Control',
  FINANCIAL_CONTROL: 'Financial Control',
  COPYRIGHT_OWNERSHIP: 'Copyright Ownership',
  DISTRIBUTION_RIGHTS: 'Distribution Rights',
  UNDERLYING_RIGHTS: 'Underlying Rights',
};

const CONTROL_TYPE_COLORS: Record<string, string> = {
  CREATIVE_CONTROL: 'bg-purple-100 text-purple-700',
  FINANCIAL_CONTROL: 'bg-blue-100 text-blue-700',
  COPYRIGHT_OWNERSHIP: 'bg-green-100 text-green-700',
  DISTRIBUTION_RIGHTS: 'bg-orange-100 text-orange-700',
  UNDERLYING_RIGHTS: 'bg-gray-100 text-gray-700',
};

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

interface RightsFormState {
  controlType: string;
  holderName: string;
  holderCountry: string;
  holderProvinceState: string;
  retentionYears: string;
  assertion: string;
  evidenceNotes: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const emptyForm: RightsFormState = {
  controlType: ControlType.CREATIVE_CONTROL as string,
  holderName: '', holderCountry: 'CA', holderProvinceState: '',
  retentionYears: '', assertion: '', evidenceNotes: '',
  effectiveFrom: '', effectiveTo: '',
};

function isCopyright(ct: string) { return ct === 'COPYRIGHT_OWNERSHIP'; }

function FactRow({ fact, projectId, onRefresh }: { fact: RightsControlFact; projectId: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RightsFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setForm({
      controlType: fact.controlType,
      holderName: fact.holderName,
      holderCountry: fact.holderCountry,
      holderProvinceState: fact.holderProvinceState ?? '',
      retentionYears: fact.retentionYears != null ? String(fact.retentionYears) : '',
      assertion: fact.assertion,
      evidenceNotes: fact.evidenceNotes ?? '',
      effectiveFrom: fact.effectiveFrom ? fact.effectiveFrom.slice(0, 10) : '',
      effectiveTo: fact.effectiveTo ? fact.effectiveTo.slice(0, 10) : '',
    });
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditError(null); };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCopyright(form.controlType) && !form.holderProvinceState) {
      setEditError('Province is required for Copyright Ownership assertions.');
      return;
    }
    if (isCopyright(form.controlType) && !form.retentionYears) {
      setEditError('Retention Years is required for Copyright Ownership assertions.');
      return;
    }
    setSaving(true); setEditError(null);
    try {
      await apiClient.patch(`/projects/${projectId}/rights-control/${fact.id}`, {
        controlType: form.controlType,
        holderName: form.holderName,
        holderCountry: form.holderCountry,
        holderProvinceState: form.holderProvinceState || null,
        retentionYears: form.retentionYears ? parseInt(form.retentionYears, 10) : null,
        assertion: form.assertion,
        evidenceNotes: form.evidenceNotes || null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
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
    if (!confirm('Delete this control assertion?')) return;
    await apiClient.delete(`/projects/${projectId}/rights-control/${fact.id}`);
    onRefresh();
  };

  if (editing) {
    return (
      <tr className="border-t border-gray-100 bg-blue-50/30">
        <td colSpan={9} className="px-4 py-3">
          <form onSubmit={saveEdit} className="space-y-3">
            {editError && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{editError}</div>}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Control Type *</label>
                <select value={form.controlType} onChange={(e) => setForm({ ...form, controlType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none">
                  {Object.values(ControlType).map((ct) => (
                    <option key={ct} value={ct}>{CONTROL_TYPE_LABELS[ct] ?? ct}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Holder Name *</label>
                <input value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
                <input value={form.holderCountry} onChange={(e) => setForm({ ...form, holderCountry: e.target.value })} maxLength={2} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Province {isCopyright(form.controlType) ? '*' : ''}</label>
                <select value={form.holderProvinceState} onChange={(e) => setForm({ ...form, holderProvinceState: e.target.value })} required={isCopyright(form.controlType)} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none">
                  {PROVINCE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              {isCopyright(form.controlType) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Retention Years *</label>
                  <input type="number" min="0" step="1" value={form.retentionYears} onChange={(e) => setForm({ ...form, retentionYears: e.target.value })} required placeholder="e.g. 25" className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective From *</label>
                <input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Effective To</label>
                <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assertion *</label>
              <textarea value={form.assertion} onChange={(e) => setForm({ ...form, assertion: e.target.value })} required rows={2} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Evidence Notes</label>
              <input value={form.evidenceNotes} onChange={(e) => setForm({ ...form, evidenceNotes: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
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

  const showCopyrightWarning = isCopyright(fact.controlType) && (!fact.holderProvinceState || fact.retentionYears == null);

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50/40 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CONTROL_TYPE_COLORS[fact.controlType] ?? ''}`}>
            {CONTROL_TYPE_LABELS[fact.controlType] ?? fact.controlType}
          </span>
        </td>
        <td className="px-3 py-2 text-sm font-medium text-gray-800">{fact.holderName}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{fact.holderCountry}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{fact.holderProvinceState || '—'}</td>
        <td className="px-3 py-2 text-sm text-gray-600">{fact.retentionYears != null ? `${fact.retentionYears} yrs` : '—'}</td>
        <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(fact.effectiveFrom)}</td>
        <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(fact.effectiveTo) || 'Current'}</td>
        <td className="px-3 py-2 text-xs text-gray-400">{fact.document ? fact.document.title : '—'}</td>
        <td className="px-3 py-2 text-right space-x-2">
          <button onClick={(e) => { e.stopPropagation(); startEdit(); }} className="text-xs text-blue-500 hover:text-blue-700">Edit</button>
          <button onClick={(e) => { e.stopPropagation(); remove(); }} className="text-xs text-red-400 hover:text-red-600">Delete</button>
        </td>
      </tr>
      {showCopyrightWarning && (
        <tr className="bg-amber-50/60">
          <td colSpan={9} className="px-4 py-1.5 text-xs text-amber-700">
            Missing {!fact.holderProvinceState ? 'Province' : ''}{!fact.holderProvinceState && fact.retentionYears == null ? ' and ' : ''}{fact.retentionYears == null ? 'Retention Years' : ''} — required for FTTC elevated tier. Click Edit to add.
          </td>
        </tr>
      )}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-4 py-3 text-sm text-gray-700 italic">
            &ldquo;{fact.assertion}&rdquo;
            {fact.evidenceNotes && <span className="ml-2 text-xs text-gray-500 not-italic">Evidence: {fact.evidenceNotes}</span>}
          </td>
        </tr>
      )}
    </>
  );
}

interface ProjectSectionProps {
  projectId: string;
}

export function RightsControlSection({ projectId }: ProjectSectionProps) {
  const { facts, isLoading, error, refetch } = useRightsControlFacts(projectId);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RightsFormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCopyright(form.controlType) && !form.holderProvinceState) {
      setFormError('Province is required for Copyright Ownership assertions.');
      return;
    }
    if (isCopyright(form.controlType) && !form.retentionYears) {
      setFormError('Retention Years is required for Copyright Ownership assertions.');
      return;
    }
    setSaving(true); setFormError(null);
    try {
      await apiClient.post(`/projects/${projectId}/rights-control`, {
        controlType: form.controlType,
        holderName: form.holderName,
        holderCountry: form.holderCountry,
        holderProvinceState: form.holderProvinceState || null,
        retentionYears: form.retentionYears ? parseInt(form.retentionYears, 10) : null,
        assertion: form.assertion,
        evidenceNotes: form.evidenceNotes || null,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      });
      setForm({ ...emptyForm });
      setShowAdd(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to add control assertion');
    } finally {
      setSaving(false);
    }
  };

  const typeCoverage = new Set(facts.map((f) => f.controlType));

  if (isLoading) return <p className="text-sm text-gray-500">Loading rights control facts...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rights &amp; Control</h2>
          <p className="mt-1 text-sm text-gray-500">
            Assert creative and financial control. Required for CAVCO and CMF eligibility tests. Click a row to read the assertion.
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Assertion
        </button>
      </div>

      {facts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.values(ControlType).map((ct) => (
            <span key={ct} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${typeCoverage.has(ct) ? CONTROL_TYPE_COLORS[ct] : 'bg-gray-100 text-gray-400'}`}>
              {typeCoverage.has(ct) ? '✓' : '○'} {CONTROL_TYPE_LABELS[ct]}
            </span>
          ))}
        </div>
      )}

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showAdd && (
        <form onSubmit={add} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-800">New Control Assertion</h3>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Control Type *</label>
              <select value={form.controlType} onChange={(e) => setForm({ ...form, controlType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                {Object.values(ControlType).map((ct) => (
                  <option key={ct} value={ct}>{CONTROL_TYPE_LABELS[ct] ?? ct}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Holder Name *</label>
              <input value={form.holderName} onChange={(e) => setForm({ ...form, holderName: e.target.value })} required placeholder="Entity holding control" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country *</label>
              <input value={form.holderCountry} onChange={(e) => setForm({ ...form, holderCountry: e.target.value })} placeholder="CA" maxLength={2} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Province {isCopyright(form.controlType) ? '*' : ''}</label>
              <select value={form.holderProvinceState} onChange={(e) => setForm({ ...form, holderProvinceState: e.target.value })} required={isCopyright(form.controlType)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                {PROVINCE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {isCopyright(form.controlType) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Retention Years *</label>
                <input type="number" min="0" step="1" value={form.retentionYears} onChange={(e) => setForm({ ...form, retentionYears: e.target.value })} required placeholder="e.g. 25" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Assertion *</label>
            <textarea value={form.assertion} onChange={(e) => setForm({ ...form, assertion: e.target.value })} required rows={2} placeholder="e.g. Producer retains final cut approval per clause 12.3 of the distribution agreement" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Evidence Notes</label>
            <input value={form.evidenceNotes} onChange={(e) => setForm({ ...form, evidenceNotes: e.target.value })} placeholder="Optional: describe supporting documents" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Assertion'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {facts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No control assertions yet. Add assertions for each required control type.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Type</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Holder</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Country</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Province</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Retention</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">From</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">To</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Evidence</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {facts.map((f) => <FactRow key={f.id} fact={f} projectId={projectId} onRefresh={refetch} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
