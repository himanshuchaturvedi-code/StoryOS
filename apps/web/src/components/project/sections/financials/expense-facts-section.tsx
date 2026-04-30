'use client';

import { useState } from 'react';
import { useExpenseFacts, type ExpenseFact } from '@/hooks/use-phase3';
import { apiClient } from '@/lib/api-client';

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}
function fmtPortion(n: number) {
  return `${(Number(n) * 100).toFixed(0)}%`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA');
}

function FactRow({ fact, projectId, onRefresh }: { fact: ExpenseFact; projectId: string; onRefresh: () => void }) {
  const amount = Number(fact.actualLine.amount);
  const eligible = amount * Number(fact.eligiblePortion);

  const remove = async () => {
    if (!confirm('Delete this expense fact? The underlying actual line will not be affected.')) return;
    await apiClient.delete(`/projects/${projectId}/expense-facts/${fact.id}`);
    onRefresh();
  };

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(fact.actualLine.transactionDate)}</td>
      <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">
        {fact.actualLine.description ?? fact.actualLine.vendor ?? '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-gray-800">{fmt(amount)}</td>
      <td className="px-3 py-2 text-center text-sm text-gray-600">{fmtPortion(fact.eligiblePortion)}</td>
      <td className="px-3 py-2 text-right font-mono text-sm font-medium text-gray-900">{fmt(eligible)}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {fact.labourFlag && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Labour</span>}
          {fact.serviceFlag && <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">Service</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{fact.vendor?.name ?? '—'}</td>
      <td className="px-3 py-2 text-right">
        <button onClick={remove} className="text-xs text-red-400 hover:text-red-600">Delete</button>
      </td>
    </tr>
  );
}

interface ProjectSectionProps {
  projectId: string;
}

export function ExpenseFactsSection({ projectId }: ProjectSectionProps) {
  const { facts, summary, isLoading, error, refetch } = useExpenseFacts(projectId);

  const [showDerive, setShowDerive] = useState(false);
  const [deriveForm, setDeriveForm] = useState({
    vendorId: '', locationId: '', productionPhaseId: '',
    eligiblePortion: '1', labourFlag: false, serviceFlag: false,
  });
  const [deriving, setDeriving] = useState(false);
  const [deriveResult, setDeriveResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const derive = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeriving(true); setFormError(null); setDeriveResult(null);
    try {
      const res = await apiClient.post<{ derived: number }>(
        `/projects/${projectId}/expense-facts/derive`,
        {
          vendorId: deriveForm.vendorId || null,
          locationId: deriveForm.locationId || null,
          productionPhaseId: deriveForm.productionPhaseId || null,
          eligiblePortion: parseFloat(deriveForm.eligiblePortion),
          labourFlag: deriveForm.labourFlag,
          serviceFlag: deriveForm.serviceFlag,
        },
      );
      setDeriveResult(`${res?.derived ?? 0} new expense fact${(res?.derived ?? 0) !== 1 ? 's' : ''} derived.`);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Derivation failed');
    } finally {
      setDeriving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading expense facts...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Expense Facts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Eligibility annotations over actual expenditures. Use &ldquo;Derive&rdquo; to create facts from unlabelled actual lines.
          </p>
        </div>
        <button onClick={() => setShowDerive(!showDerive)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Derive from Actuals
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Facts', value: summary.totalFacts.toString() },
            { label: 'Total Expenditure', value: fmt(summary.totalAmount) },
            { label: 'Eligible Amount', value: fmt(summary.eligibleAmount) },
            { label: 'Labour Eligible', value: fmt(summary.labour.eligibleAmount) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}
      {deriveResult && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{deriveResult}</div>
      )}

      {showDerive && (
        <form onSubmit={derive} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-800">Derive from Actual Lines</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Creates expense facts for every actual line in this project that doesn&apos;t have one yet. Apply uniform annotations below.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Eligible Portion (0–1)</label>
              <input type="number" step="0.01" min="0" max="1" value={deriveForm.eligiblePortion} onChange={(e) => setDeriveForm({ ...deriveForm, eligiblePortion: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor ID</label>
              <input value={deriveForm.vendorId} onChange={(e) => setDeriveForm({ ...deriveForm, vendorId: e.target.value })} placeholder="UUID (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location ID</label>
              <input value={deriveForm.locationId} onChange={(e) => setDeriveForm({ ...deriveForm, locationId: e.target.value })} placeholder="UUID (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Production Phase ID</label>
              <input value={deriveForm.productionPhaseId} onChange={(e) => setDeriveForm({ ...deriveForm, productionPhaseId: e.target.value })} placeholder="UUID (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div className="col-span-2 flex items-end gap-6 pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={deriveForm.labourFlag} onChange={(e) => setDeriveForm({ ...deriveForm, labourFlag: e.target.checked })} className="rounded" />
                Labour expenditure
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={deriveForm.serviceFlag} onChange={(e) => setDeriveForm({ ...deriveForm, serviceFlag: e.target.checked })} className="rounded" />
                Service expenditure
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={deriving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{deriving ? 'Deriving...' : 'Derive Facts'}</button>
            <button type="button" onClick={() => setShowDerive(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {facts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No expense facts yet. Use &ldquo;Derive from Actuals&rdquo; to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Eligible %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Eligible $</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Flags</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Vendor</th>
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
