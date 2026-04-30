'use client';

import { useState } from 'react';
import { useFinancePlans, type FinancePlan, type FinanceSource } from '@/hooks/use-finance-plans';
import { apiClient } from '@/lib/api-client';
import { FinanceSourceType, FinanceSourceStatus } from '@storyos/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  FEDERAL_TAX_CREDIT: 'Federal Tax Credit',
  PROVINCIAL_TAX_CREDIT: 'Provincial Tax Credit',
  BROADCASTER_LICENSE: 'Broadcaster Licence',
  DISTRIBUTION_ADVANCE: 'Distribution Advance',
  PRE_SALE: 'Pre-Sale',
  EQUITY: 'Equity',
  GAP_FINANCING: 'Gap Financing',
  GRANT: 'Grant',
  DEFERRAL: 'Deferral',
  OTHER: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  ESTIMATED: 'bg-yellow-100 text-yellow-700',
  COMMITTED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
};

// ── Source Row ────────────────────────────────────────────────────────────────

function SourceRow({
  source,
  onDelete,
}: {
  source: FinanceSource;
  onDelete: () => void;
}) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-5 py-2.5 text-sm text-gray-800">
        {SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-700">{source.name}</td>
      <td className="px-3 py-2.5 text-right font-mono text-sm text-gray-800">
        {fmt(Number(source.amount))}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[source.status] ?? ''}`}
        >
          {source.status}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-gray-500">{source.conditions ?? '—'}</td>
      <td className="px-3 py-2.5 text-right">
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onDeleted,
  onRefresh,
}: {
  plan: FinancePlan;
  onDeleted: () => void;
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    sourceType: FinanceSourceType.EQUITY,
    name: '',
    amount: '',
    currency: 'CAD',
    status: FinanceSourceStatus.ESTIMATED,
    conditions: '',
  });
  const [saving, setSaving] = useState(false);

  const total = plan.sources.reduce((s, src) => s + Number(src.amount), 0);

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post(`/finance-plans/${plan.id}/sources`, {
        sourceType: form.sourceType,
        name: form.name,
        amount: parseFloat(form.amount),
        currency: form.currency,
        status: form.status,
        conditions: form.conditions || null,
      });
      setForm({
        sourceType: FinanceSourceType.EQUITY,
        name: '',
        amount: '',
        currency: 'CAD',
        status: FinanceSourceStatus.ESTIMATED,
        conditions: '',
      });
      setShowAdd(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const deleteSource = async (sourceId: string) => {
    await apiClient.delete(`/finance-plans/${plan.id}/sources/${sourceId}`);
    onRefresh();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Plan header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
          <p className="text-xs text-gray-500">
            Base currency: {plan.baseCurrency}
            {plan.notes && ` · ${plan.notes}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            Total: {fmt(total)}
          </span>
          <button
            onClick={onDeleted}
            className="text-xs text-red-400 hover:text-red-600"
          >
            Delete Plan
          </button>
        </div>
      </div>

      {/* Sources table */}
      {plan.sources.length === 0 ? (
        <p className="px-5 py-5 text-sm text-gray-400 text-center">
          No funding sources yet. Add the first source below.
        </p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-5 py-2 text-xs font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Name / Funder</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Status</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-500">Conditions</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {plan.sources.map((src) => (
              <SourceRow
                key={src.id}
                source={src}
                onDelete={() => deleteSource(src.id)}
              />
            ))}
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td colSpan={2} className="px-5 py-2 text-sm text-gray-900">Total</td>
              <td className="px-3 py-2 text-right font-mono text-sm text-gray-900">{fmt(total)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      )}

      {/* Add source form */}
      {showAdd ? (
        <form
          onSubmit={addSource}
          className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm({ ...form, sourceType: e.target.value as FinanceSourceType })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                required
              >
                {Object.values(FinanceSourceType).map((t) => (
                  <option key={t} value={t}>{SOURCE_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name / Funder *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Telefilm Canada"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FinanceSourceStatus })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                {Object.values(FinanceSourceStatus).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Conditions</label>
              <input
                value={form.conditions}
                onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                placeholder="Optional conditions (e.g. subject to approval)"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Source'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-gray-100 px-5 py-3">
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm text-brand-600 hover:text-brand-800"
          >
            + Add funding source
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ProjectSectionProps {
  projectId: string;
}

export function FinanceSection({ projectId }: ProjectSectionProps) {

  const { plans, isLoading, error, refetch } = useFinancePlans(projectId);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCurrency, setNewCurrency] = useState('CAD');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      await apiClient.post(`/projects/${projectId}/finance-plans`, {
        name: newName.trim(),
        baseCurrency: newCurrency,
        notes: newNotes || null,
      });
      setNewName('');
      setNewNotes('');
      setShowNew(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this finance plan?')) return;
    try {
      await apiClient.delete(`/projects/${projectId}/finance-plans/${id}`);
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete plan');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading finance plans...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Finance Plans</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track where the money comes from. Each plan holds a set of funding sources.
          </p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New Plan
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showNew && (
        <form
          onSubmit={createPlan}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3"
        >
          <h3 className="text-sm font-medium text-gray-800">New Finance Plan</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Initial Estimate"
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Base Currency</label>
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Plan'}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">
            No finance plans yet. Create a plan and add your funding sources.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onDeleted={() => deletePlan(plan.id)}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
