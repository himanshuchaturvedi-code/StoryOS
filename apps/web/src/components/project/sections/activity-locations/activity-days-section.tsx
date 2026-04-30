'use client';

import { useState } from 'react';
import { useActivityDays, type ActivityDay } from '@/hooks/use-phase3';
import { apiClient } from '@/lib/api-client';
import { formatProvinceStateCell } from '@/lib/province-display';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-CA');
}

function DayRow({ day, projectId, onRefresh }: { day: ActivityDay; projectId: string; onRefresh: () => void }) {
  const remove = async () => {
    if (!confirm('Delete this activity day?')) return;
    await apiClient.delete(`/projects/${projectId}/activity-days/${day.id}`);
    onRefresh();
  };

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-2 text-sm text-gray-800">{fmtDate(day.activityDate)}</td>
      <td className="px-3 py-2 text-sm text-gray-700">
        {day.person.firstName} {day.person.lastName}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{day.roleType.name}</td>
      <td className="px-3 py-2 text-sm text-gray-600">
        {day.location.name}
        {day.location.provinceState &&
          ` · ${formatProvinceStateCell(day.location.country, day.location.provinceState)}`}
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">{day.productionPhase?.name ?? '—'}</td>
      <td className="px-3 py-2 text-sm text-gray-500">{day.hoursWorked != null ? `${day.hoursWorked}h` : '—'}</td>
      <td className="px-3 py-2 text-right">
        <button onClick={remove} className="text-xs text-red-400 hover:text-red-600">Delete</button>
      </td>
    </tr>
  );
}

interface ProjectSectionProps {
  projectId: string;
}

export function ActivityDaysSection({ projectId }: ProjectSectionProps) {
  const { days, isLoading, error, refetch } = useActivityDays(projectId);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    personId: '', roleTypeId: '', locationId: '', productionPhaseId: '',
    activityDate: '', hoursWorked: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError(null);
    try {
      await apiClient.post(`/projects/${projectId}/activity-days`, {
        personId: form.personId,
        roleTypeId: form.roleTypeId,
        locationId: form.locationId,
        productionPhaseId: form.productionPhaseId || null,
        activityDate: form.activityDate,
        hoursWorked: form.hoursWorked ? parseFloat(form.hoursWorked) : null,
        notes: form.notes || null,
      });
      setForm({ personId: '', roleTypeId: '', locationId: '', productionPhaseId: '', activityDate: '', hoursWorked: '', notes: '' });
      setShowAdd(false);
      await refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to add activity day');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading activity days...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Activity Days</h2>
          <p className="mt-1 text-sm text-gray-500">
            Record who worked, where, in which role, and on which date. Used for incentive eligibility calculations.
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Log Activity Day
        </button>
      </div>

      {(error || formError) && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error ?? formError}</div>
      )}

      {showAdd && (
        <form onSubmit={add} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-800">Log Activity Day</h3>
          <p className="text-xs text-gray-500">Enter the IDs of the person, role type, and location. Use the Persons and Locations pages to find IDs.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Person ID *</label>
              <input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })} required placeholder="UUID" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role Type ID *</label>
              <input value={form.roleTypeId} onChange={(e) => setForm({ ...form, roleTypeId: e.target.value })} required placeholder="UUID" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location ID *</label>
              <input value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} required placeholder="UUID" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Activity Date *</label>
              <input type="date" value={form.activityDate} onChange={(e) => setForm({ ...form, activityDate: e.target.value })} required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Production Phase ID</label>
              <input value={form.productionPhaseId} onChange={(e) => setForm({ ...form, productionPhaseId: e.target.value })} placeholder="UUID (optional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hours Worked</label>
              <input type="number" step="0.5" min="0" max="24" value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} placeholder="Optional" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving...' : 'Log Day'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {days.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No activity days logged yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-3">
            <span className="text-sm font-medium text-gray-700">{days.length} activity day{days.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-xs font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Person</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Role</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Location</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Phase</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Hours</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {days.map((d) => <DayRow key={d.id} day={d} projectId={projectId} onRefresh={refetch} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
