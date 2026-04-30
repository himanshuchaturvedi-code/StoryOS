'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useTenant } from '@/contexts/tenant-context';
import { useLocations, type Location, type ProjectLocation } from '@/hooks/use-locations';
import { Button, Card, CardContent, CardHeader } from '@storyos/ui';
import { formatProvinceStateCell } from '@/lib/province-display';

interface ProjectSectionProps {
  projectId: string;
}

export function LocationsSection({ projectId }: ProjectSectionProps) {
  const { currentOrgId } = useTenant();
  const { locations } = useLocations(currentOrgId);

  const [projectLocations, setProjectLocations] = useState<ProjectLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const fetchProjectLocations = useCallback(async () => {
    try {
      const list =
        (await apiClient.get<ProjectLocation[]>(`/projects/${projectId}/locations`)) ?? [];
      setProjectLocations(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load locations');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectLocations();
  }, [fetchProjectLocations]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLocationId) return;
    setIsLinking(true);
    try {
      await apiClient.post(`/projects/${projectId}/locations`, {
        locationId: selectedLocationId,
        isPrimary,
      });
      setSelectedLocationId('');
      setIsPrimary(false);
      await fetchProjectLocations();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to link location');
    } finally {
      setIsLinking(false);
    }
  }

  async function handleSetPrimary(projectLocationId: string) {
    try {
      await apiClient.patch(`/projects/${projectId}/locations/${projectLocationId}/primary`, {});
      await fetchProjectLocations();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to set primary');
    }
  }

  async function handleUnlink(projectLocationId: string) {
    try {
      await apiClient.delete(`/projects/${projectId}/locations/${projectLocationId}`);
      await fetchProjectLocations();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to unlink location');
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  const linkedIds = new Set(projectLocations.map((pl) => pl.locationId));
  const available = locations.filter((l) => !linkedIds.has(l.id));

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Link a location</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLink} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Location</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select a location…</option>
                {available.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.city ?? l.country} ({l.locationType})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-gray-300"
              />
              Set as primary location
            </label>
            <Button type="submit" disabled={!selectedLocationId || isLinking}>
              {isLinking ? 'Linking…' : 'Link location'}
            </Button>
          </form>
          {available.length === 0 && locations.length > 0 && (
            <p className="mt-2 text-sm text-gray-500">
              All org locations are already linked to this project.
            </p>
          )}
          {locations.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No locations in your org yet. Add locations in the org library first.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Project locations ({projectLocations.length})</h2>
        </CardHeader>
        <CardContent>
          {projectLocations.length === 0 ? (
            <p className="text-sm text-gray-500">No locations linked yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {projectLocations.map((pl) => (
                <li key={pl.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{pl.location.name}</span>
                      {pl.isPrimary && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {[
                        pl.location.city,
                        formatProvinceStateCell(pl.location.country, pl.location.provinceState),
                        pl.location.country,
                      ]
                        .filter((x) => x && x !== '—')
                        .join(', ')}
                      {' · '}
                      {pl.location.locationType}
                      {pl.location.incentiveRegionCode ? (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                          {pl.location.incentiveRegionCode}
                        </span>
                      ) : (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          Region not set
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!pl.isPrimary && (
                      <Button variant="ghost" size="sm" onClick={() => handleSetPrimary(pl.id)}>
                        Set primary
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleUnlink(pl.id)}>
                      Unlink
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
