'use client';

import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useTenant } from '@/contexts/tenant-context';
import { useLocations, type Location } from '@/hooks/use-locations';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { LocationType, SUPPORTED_COUNTRIES, INCENTIVE_REGIONS } from '@storyos/types';
import { CanadianProvinceSelect } from '@/components/canadian-province-select';
import { formatProvinceStateCell } from '@/lib/province-display';

const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: LocationType.STUDIO, label: 'Studio' },
  { value: LocationType.ON_LOCATION, label: 'On location' },
  { value: LocationType.OFFICE, label: 'Office' },
  { value: LocationType.POST_FACILITY, label: 'Post facility' },
  { value: LocationType.VFX_FACILITY, label: 'VFX facility' },
  { value: LocationType.OTHER, label: 'Other' },
];

function regionsForProvince(provinceState: string | undefined): typeof INCENTIVE_REGIONS[number][] {
  if (!provinceState) return [...INCENTIVE_REGIONS];
  const iso = provinceState.startsWith('CA-') ? provinceState : `CA-${provinceState}`;
  return INCENTIVE_REGIONS.filter((r) => r.provinceState === iso);
}

function IncentiveRegionSelect({
  value,
  onChange,
  provinceState,
  country,
}: {
  value: string;
  onChange: (v: string) => void;
  provinceState?: string;
  country?: string;
}) {
  const options = country === 'CA' ? regionsForProvince(provinceState) : [...INCENTIVE_REGIONS];
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        Incentive region
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">— None —</option>
        {options.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label} ({r.code})
          </option>
        ))}
      </select>
    </div>
  );
}

export default function LocationsPage() {
  const { currentOrgId } = useTenant();
  const { locations, isLoading, error, refetch } = useLocations(currentOrgId);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('CA');
  const [provinceState, setProvinceState] = useState('');
  const [city, setCity] = useState('');
  const [locationType, setLocationType] = useState<LocationType>(LocationType.ON_LOCATION);
  const [incentiveRegionCode, setIncentiveRegionCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCountry, setEditCountry] = useState('CA');
  const [editProvinceState, setEditProvinceState] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editLocationType, setEditLocationType] = useState<LocationType>(LocationType.ON_LOCATION);
  const [editIncentiveRegionCode, setEditIncentiveRegionCode] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function resetCreateForm() {
    setName('');
    setCountry('CA');
    setProvinceState('');
    setCity('');
    setLocationType(LocationType.ON_LOCATION);
    setIncentiveRegionCode('');
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/locations', {
        name,
        country,
        provinceState: provinceState || undefined,
        city: city || undefined,
        locationType,
        incentiveRegionCode: incentiveRegionCode || undefined,
      });
      await refetch();
      resetCreateForm();
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to create location');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEdit(loc: Location) {
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditCountry(loc.country);
    setEditProvinceState(loc.provinceState ?? '');
    setEditCity(loc.city ?? '');
    setEditLocationType((loc.locationType as LocationType) ?? LocationType.ON_LOCATION);
    setEditIncentiveRegionCode(loc.incentiveRegionCode ?? '');
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await apiClient.patch(`/locations/${editingId}`, {
        name: editName,
        country: editCountry,
        provinceState: editProvinceState || null,
        city: editCity || null,
        locationType: editLocationType,
        incentiveRegionCode: editIncentiveRegionCode || null,
      });
      setEditingId(null);
      await refetch();
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/locations/${id}`);
      await refetch();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to delete location');
    }
  }

  if (!currentOrgId) {
    return <p className="text-sm text-gray-500">Select an organization to manage locations.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Location library</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add location'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">New location</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Country</label>
                  <select
                    value={country}
                    onChange={(e) => { setCountry(e.target.value); setIncentiveRegionCode(''); }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {SUPPORTED_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                {country === 'CA' ? (
                  <CanadianProvinceSelect
                    value={provinceState}
                    onChange={(v) => { setProvinceState(v); setIncentiveRegionCode(''); }}
                  />
                ) : (
                  <Input
                    label="Province / State (optional, max 10 chars)"
                    value={provinceState}
                    onChange={(e) => setProvinceState(e.target.value)}
                    maxLength={10}
                  />
                )}
              </div>
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Location type
                  </label>
                  <select
                    value={locationType}
                    onChange={(e) => setLocationType(e.target.value as LocationType)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {LOCATION_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <IncentiveRegionSelect
                  value={incentiveRegionCode}
                  onChange={setIncentiveRegionCode}
                  provinceState={provinceState}
                  country={country}
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save location'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading locations…</p>
      ) : locations.length === 0 ? (
        <p className="text-sm text-gray-500">No locations yet. Add one to get started.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Region</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{loc.name}</td>
                  <td className="px-4 py-3 text-gray-600">{loc.locationType}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {[loc.city, formatProvinceStateCell(loc.country, loc.provinceState), loc.country].filter(Boolean).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {loc.incentiveRegionCode ? (
                      <span>{loc.incentiveRegionCode}</span>
                    ) : (
                      <span className="text-amber-600 font-medium">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(loc.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {editingId && (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <h3 className="font-medium text-gray-900">Edit location</h3>
                <Input
                  label="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Country</label>
                    <select
                      value={editCountry}
                      onChange={(e) => { setEditCountry(e.target.value); setEditIncentiveRegionCode(''); }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {SUPPORTED_COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {editCountry === 'CA' ? (
                    <CanadianProvinceSelect
                      value={editProvinceState}
                      onChange={(v) => { setEditProvinceState(v); setEditIncentiveRegionCode(''); }}
                    />
                  ) : (
                    <Input
                      label="Province / State"
                      value={editProvinceState}
                      onChange={(e) => setEditProvinceState(e.target.value)}
                      maxLength={10}
                    />
                  )}
                </div>
                <Input
                  label="City"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Location type</label>
                    <select
                      value={editLocationType}
                      onChange={(e) => setEditLocationType(e.target.value as LocationType)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {LOCATION_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <IncentiveRegionSelect
                    value={editIncentiveRegionCode}
                    onChange={setEditIncentiveRegionCode}
                    provinceState={editProvinceState}
                    country={editCountry}
                  />
                </div>
                {editError && <p className="text-sm text-red-600">{editError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
