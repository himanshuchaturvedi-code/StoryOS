'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useTenant } from '@/contexts/tenant-context';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { CanadianProvinceSelect } from '@/components/canadian-province-select';
import { formatProvinceStateCell } from '@/lib/province-display';

interface Residency {
  id: string;
  residencyType: string;
  country: string;
  provinceState?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
}

interface PersonDetail {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  citizenship?: string | null;
  city?: string | null;
  provinceState?: string | null;
  country?: string | null;
  participations?: Array<{
    id: string;
    project: { id: string; title: string; stage: string };
    roles: Array<{ id: string; roleType: { code: string; name: string } }>;
  }>;
  residencyStatuses?: Residency[];
}

const RESIDENCY_TYPES = ['CITIZEN', 'PERMANENT_RESIDENT', 'TEMPORARY_RESIDENT', 'NON_RESIDENT'];

export default function PersonDetailPage() {
  const params = useParams();
  const personId = params?.personId as string;
  const { currentOrgId } = useTenant();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editing, setEditing] = useState(false);
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCitizenship, setEditCitizenship] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editProvinceState, setEditProvinceState] = useState('');
  const [editCountry, setEditCountry] = useState('CA');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Residency form state
  const [showResForm, setShowResForm] = useState(false);
  const [editingResId, setEditingResId] = useState<string | null>(null);
  const [resType, setResType] = useState('CITIZEN');
  const [resCountry, setResCountry] = useState('CA');
  const [resProvince, setResProvince] = useState('');
  const [resFrom, setResFrom] = useState('');
  const [resTo, setResTo] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [resError, setResError] = useState<string | null>(null);
  const [resSaving, setResSaving] = useState(false);

  const fetchPerson = useCallback(async () => {
    if (!currentOrgId || !personId) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<PersonDetail>(`/persons/${personId}`);
      setPerson(data);
    } catch (e) {
      setPerson(null);
      setError(e instanceof ApiError ? e.message : 'Failed to load person');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, personId]);

  useEffect(() => { fetchPerson(); }, [fetchPerson]);

  function openEdit() {
    if (!person) return;
    setEditFirst(person.firstName);
    setEditLast(person.lastName);
    setEditEmail(person.email ?? '');
    setEditPhone(person.phone ?? '');
    setEditCitizenship(person.citizenship ?? '');
    setEditCity(person.city ?? '');
    setEditProvinceState(person.provinceState ?? '');
    setEditCountry(person.country ?? 'CA');
    setEditError(null);
    setEditing(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setEditError(null);
    try {
      await apiClient.patch(`/persons/${personId}`, {
        firstName: editFirst,
        lastName: editLast,
        email: editEmail || null,
        phone: editPhone || null,
        citizenship: editCitizenship || null,
        city: editCity || null,
        provinceState: editProvinceState || null,
        country: editCountry || null,
      });
      setEditing(false);
      await fetchPerson();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function resetResForm() {
    setEditingResId(null);
    setResType('CITIZEN');
    setResCountry('CA');
    setResProvince('');
    setResFrom('');
    setResTo('');
    setResNotes('');
    setResError(null);
    setShowResForm(false);
  }

  function openAddRes() {
    resetResForm();
    setShowResForm(true);
  }

  async function handleDeleteRes(r: Residency) {
    const label = `${r.residencyType.replace(/_/g, ' ')} (${r.country}) from ${r.effectiveFrom.slice(0, 10)}`;
    if (!confirm(`Delete residency record?\n\n${label}\n\nThis action is logged and will mark related evaluations as stale.`)) return;
    try {
      await apiClient.delete(`/persons/${personId}/residency/${r.id}`);
      await fetchPerson();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to delete');
    }
  }

  function openEditRes(r: Residency) {
    setEditingResId(r.id);
    setResType(r.residencyType);
    setResCountry(r.country);
    setResProvince(r.provinceState ?? '');
    setResFrom(r.effectiveFrom.slice(0, 10));
    setResTo(r.effectiveTo?.slice(0, 10) ?? '');
    setResNotes(r.notes ?? '');
    setResError(null);
    setShowResForm(true);
  }

  async function handleSaveRes(e: React.FormEvent) {
    e.preventDefault();
    setResSaving(true);
    setResError(null);
    try {
      if (editingResId) {
        await apiClient.patch(`/persons/${personId}/residency/${editingResId}`, {
          residencyType: resType,
          country: resCountry,
          provinceState: resProvince || undefined,
          effectiveFrom: resFrom,
          effectiveTo: resTo || undefined,
          notes: resNotes || undefined,
        });
      } else {
        await apiClient.post(`/persons/${personId}/residency`, {
          residencyType: resType,
          country: resCountry,
          provinceState: resProvince || undefined,
          effectiveFrom: resFrom,
          effectiveTo: resTo || undefined,
          notes: resNotes || undefined,
        });
      }
      resetResForm();
      await fetchPerson();
    } catch (e) {
      setResError(e instanceof ApiError ? e.message : 'Failed to save residency');
    } finally {
      setResSaving(false);
    }
  }

  if (!currentOrgId) {
    return <p className="text-sm text-gray-500">Select an organization to view persons.</p>;
  }
  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }
  if (error || !person) {
    return (
      <div>
        <p className="text-sm text-red-600">{error ?? 'Person not found'}</p>
        <Link href="/persons">
          <Button variant="outline" className="mt-4">Back to persons</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {person.firstName} {person.lastName}
        </h1>
        <div className="flex gap-2">
          <Button onClick={openEdit}>Edit</Button>
          <Link href="/persons">
            <Button variant="outline">Back</Button>
          </Link>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Edit person</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First name" value={editFirst} onChange={(e) => setEditFirst(e.target.value)} required />
                <Input label="Last name" value={editLast} onChange={(e) => setEditLast(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                <Input label="Phone" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <Input
                label="Citizenship (ISO 2-letter, e.g. CA)"
                value={editCitizenship}
                onChange={(e) => setEditCitizenship(e.target.value.toUpperCase())}
                maxLength={2}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="City"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
                {editCountry === 'CA' ? (
                  <CanadianProvinceSelect value={editProvinceState} onChange={setEditProvinceState} />
                ) : (
                  <Input
                    label="Province / State"
                    value={editProvinceState}
                    onChange={(e) => setEditProvinceState(e.target.value)}
                    maxLength={10}
                  />
                )}
                <Input
                  label="Country (ISO)"
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                />
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Details card */}
      <Card>
        <CardHeader><h2 className="font-medium text-gray-900">Details</h2></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p><span className="text-gray-500">Email:</span> {person.email ?? '—'}</p>
          <p><span className="text-gray-500">Phone:</span> {person.phone ?? '—'}</p>
          <p><span className="text-gray-500">Citizenship:</span> {person.citizenship ?? '—'}</p>
          {([person.city, person.provinceState, person.country].some(Boolean)) && (
            <p>
              <span className="text-gray-500">Location:</span>{' '}
              {[person.city, person.provinceState, person.country].filter(Boolean).join(', ')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Residency history */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-900">Residency history</h2>
            <Button onClick={openAddRes}>Add record</Button>
          </div>
        </CardHeader>
        <CardContent>
          {showResForm && (
            <form onSubmit={handleSaveRes} className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    {RESIDENCY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <Input label="Country (ISO)" value={resCountry} onChange={(e) => setResCountry(e.target.value.toUpperCase())} maxLength={2} required />
              </div>
              {resCountry === 'CA' ? (
                <CanadianProvinceSelect value={resProvince} onChange={setResProvince} />
              ) : (
                <Input
                  label="Province / State (optional, max 10 chars)"
                  value={resProvince}
                  onChange={(e) => setResProvince(e.target.value)}
                  maxLength={10}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Effective from" type="date" value={resFrom} onChange={(e) => setResFrom(e.target.value)} required />
                <Input label="Effective to (optional)" type="date" value={resTo} onChange={(e) => setResTo(e.target.value)} />
              </div>
              <Input label="Notes (optional)" value={resNotes} onChange={(e) => setResNotes(e.target.value)} />
              {resError && <p className="text-sm text-red-600">{resError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={resSaving}>{resSaving ? 'Saving…' : (editingResId ? 'Update' : 'Add')}</Button>
                <Button type="button" variant="outline" onClick={resetResForm}>Cancel</Button>
              </div>
            </form>
          )}

          {(!person.residencyStatuses || person.residencyStatuses.length === 0) ? (
            <p className="text-sm text-gray-500">No residency records.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Country</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Province</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">From</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">To</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {person.residencyStatuses.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">{r.residencyType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-gray-600">{r.country}</td>
                    <td className="px-3 py-2 text-gray-600">{formatProvinceStateCell(r.country, r.provinceState)}</td>
                    <td className="px-3 py-2 text-gray-600">{r.effectiveFrom.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-gray-600">{r.effectiveTo?.slice(0, 10) ?? 'Ongoing'}</td>
                    <td className="px-3 py-2 space-x-2">
                      <button
                        onClick={() => openEditRes(r)}
                        className="text-sm text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRes(r)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Project participations */}
      {person.participations && person.participations.length > 0 && (
        <Card>
          <CardHeader><h2 className="font-medium text-gray-900">Project participation</h2></CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {person.participations.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.project.id}`} className="font-medium text-brand-600 hover:underline">
                    {p.project.title}
                  </Link>
                  <span className="ml-2 text-gray-400">{p.project.stage}</span>
                  {p.roles.length > 0 && (
                    <ul className="mt-1 text-gray-600">
                      {p.roles.map((r) => <li key={r.id}>{r.roleType.name}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
