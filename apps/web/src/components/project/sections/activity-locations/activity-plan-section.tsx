'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatProvinceStateCell } from '@/lib/province-display';
import type { ProjectLocation } from '@/hooks/use-locations';
import { Button, Card, CardContent, CardHeader } from '@storyos/ui';

interface ProjectDetail {
  id: string;
  phases?: ProjectPhase[];
}

interface ProjectPhase {
  id: string;
  phaseType: string;
  name?: string | null;
}

interface IncentiveRegion {
  code: string;
  label: string;
  provinceState: string;
  zoneCode: string | null;
}

interface ActivityPlan {
  id: string;
  locationId: string;
  productionPhaseId: string;
  plannedDays: number;
  notes?: string | null;
  location: {
    id: string;
    name: string;
    country: string;
    provinceState?: string | null;
    zoneCode?: string | null;
  };
  productionPhase: {
    id: string;
    phaseType: string;
    name?: string | null;
  };
}

interface RowDraft {
  productionPhaseId: string;
  regionCode: string;
  plannedDays: string;
}

function emptyDraft(): RowDraft {
  return {
    productionPhaseId: '',
    regionCode: '',
    plannedDays: '',
  };
}

function formatPhaseLabel(phase: Pick<ProjectPhase, 'phaseType' | 'name'>) {
  if (phase.name?.trim()) return phase.name;
  return phase.phaseType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function findRegionCode(
  location: ActivityPlan['location'],
  regions: IncentiveRegion[],
): string {
  return (
    regions.find(
      (region) =>
        region.label === location.name &&
        region.provinceState === location.provinceState &&
        region.zoneCode === (location.zoneCode ?? null),
    )?.code ?? ''
  );
}

interface ProjectSectionProps {
  projectId: string;
}

export function ActivityPlanSection({ projectId }: ProjectSectionProps) {

  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [projectLocations, setProjectLocations] = useState<ProjectLocation[]>([]);
  const [regions, setRegions] = useState<IncentiveRegion[]>([]);
  const [plans, setPlans] = useState<ActivityPlan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [newRow, setNewRow] = useState<RowDraft>(emptyDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [deletingRows, setDeletingRows] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const primaryLocation = useMemo(
    () => projectLocations.find((location) => location.isPrimary)?.location ?? null,
    [projectLocations],
  );
  const primaryProvinceState = primaryLocation?.provinceState ?? null;

  const filteredRegions = useMemo(() => {
    if (!primaryProvinceState) return [];
    return regions.filter((region) => region.provinceState === primaryProvinceState);
  }, [primaryProvinceState, regions]);

  const loadData = useCallback(async () => {
    if (!projectId) return;

    try {
      setError(null);
      setIsLoading(true);

      const [project, locations, incentiveRegions, activityPlans] = await Promise.all([
        apiClient.get<ProjectDetail>(`/projects/${projectId}`),
        apiClient.get<ProjectLocation[]>(`/projects/${projectId}/locations`),
        apiClient.get<IncentiveRegion[]>('/reference/incentive-regions'),
        apiClient.get<ActivityPlan[]>(`/projects/${projectId}/activity-plans`),
      ]);

      const nextPhases = project.phases ?? [];
      const nextPlans = activityPlans ?? [];
      const nextRegions = incentiveRegions ?? [];

      setPhases(nextPhases);
      setProjectLocations(locations ?? []);
      setRegions(nextRegions);
      setPlans(nextPlans);
      setDrafts(
        Object.fromEntries(
          nextPlans.map((plan) => [
            plan.id,
            {
              productionPhaseId: plan.productionPhaseId,
              regionCode: findRegionCode(plan.location, nextRegions),
              plannedDays: String(plan.plannedDays),
            },
          ]),
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load activity plan');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getRegionOptions = useCallback(
    (currentRegionCode?: string) => {
      if (!primaryProvinceState) {
        if (!currentRegionCode) return [];
        const current = regions.find((region) => region.code === currentRegionCode);
        return current ? [current] : [];
      }

      if (!currentRegionCode) return filteredRegions;

      if (filteredRegions.some((region) => region.code === currentRegionCode)) {
        return filteredRegions;
      }

      const current = regions.find((region) => region.code === currentRegionCode);
      return current ? [current, ...filteredRegions] : filteredRegions;
    },
    [filteredRegions, primaryProvinceState, regions],
  );

  async function handleAdd() {
    if (!newRow.productionPhaseId || !newRow.regionCode || !newRow.plannedDays) return;

    try {
      setError(null);
      setIsAdding(true);
      await apiClient.post(`/projects/${projectId}/activity-plans`, {
        productionPhaseId: newRow.productionPhaseId,
        regionCode: newRow.regionCode,
        plannedDays: Number(newRow.plannedDays),
      });
      setNewRow(emptyDraft());
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add activity plan row');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSave(planId: string) {
    const draft = drafts[planId];
    if (!draft || !draft.productionPhaseId || !draft.regionCode || !draft.plannedDays) return;

    try {
      setError(null);
      setSavingRows((current) => ({ ...current, [planId]: true }));
      await apiClient.patch(`/projects/${projectId}/activity-plans/${planId}`, {
        productionPhaseId: draft.productionPhaseId,
        regionCode: draft.regionCode,
        plannedDays: Number(draft.plannedDays),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update activity plan row');
    } finally {
      setSavingRows((current) => ({ ...current, [planId]: false }));
    }
  }

  async function handleDelete(planId: string) {
    if (!confirm('Delete this activity plan row?')) return;

    try {
      setError(null);
      setDeletingRows((current) => ({ ...current, [planId]: true }));
      await apiClient.delete(`/projects/${projectId}/activity-plans/${planId}`);
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete activity plan row');
    } finally {
      setDeletingRows((current) => ({ ...current, [planId]: false }));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading activity plan...</p>;
  }

  const primaryProvinceLabel = primaryProvinceState
    ? formatProvinceStateCell('CA', primaryProvinceState)
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">Activity Plan</h2>
            <p className="text-sm text-gray-500">
              Plan days by production phase and incentive region. These rows power Part A
              estimates before actual activity days exist.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {!primaryProvinceState && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Set a primary project location on the Locations page to unlock incentive-region
              selection.
            </div>
          )}

          {primaryProvinceLabel && (
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
              Region options are filtered to <span className="font-medium">{primaryProvinceLabel}</span>{' '}
              based on the project&apos;s primary location.
            </div>
          )}

          {phases.length === 0 && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Add at least one production phase before entering an activity plan.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Phase
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Region
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Planned Days
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      No activity plan rows yet.
                    </td>
                  </tr>
                )}

                {plans.map((plan) => {
                  const draft = drafts[plan.id];
                  const regionOptions = getRegionOptions(draft?.regionCode);

                  return (
                    <tr key={plan.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        <select
                          value={draft?.productionPhaseId ?? ''}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [plan.id]: {
                                ...(current[plan.id] ?? emptyDraft()),
                                productionPhaseId: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                        >
                          <option value="">Select phase…</option>
                          {phases.map((phase) => (
                            <option key={phase.id} value={phase.id}>
                              {formatPhaseLabel(phase)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={draft?.regionCode ?? ''}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [plan.id]: {
                                ...(current[plan.id] ?? emptyDraft()),
                                regionCode: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                        >
                          <option value="">Select region…</option>
                          {regionOptions.map((region) => (
                            <option key={region.code} value={region.code}>
                              {region.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={draft?.plannedDays ?? ''}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [plan.id]: {
                                ...(current[plan.id] ?? emptyDraft()),
                                plannedDays: e.target.value,
                              },
                            }))
                          }
                          className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleSave(plan.id)}
                            disabled={
                              savingRows[plan.id] ||
                              !draft?.productionPhaseId ||
                              !draft?.regionCode ||
                              !draft?.plannedDays
                            }
                          >
                            {savingRows[plan.id] ? 'Saving…' : 'Save'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(plan.id)}
                            disabled={deletingRows[plan.id]}
                          >
                            {deletingRows[plan.id] ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                <tr className="border-t border-gray-200 bg-gray-50/50">
                  <td className="px-4 py-3">
                    <select
                      value={newRow.productionPhaseId}
                      onChange={(e) =>
                        setNewRow((current) => ({
                          ...current,
                          productionPhaseId: e.target.value,
                        }))
                      }
                      disabled={phases.length === 0}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-100"
                    >
                      <option value="">Select phase…</option>
                      {phases.map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {formatPhaseLabel(phase)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={newRow.regionCode}
                      onChange={(e) =>
                        setNewRow((current) => ({
                          ...current,
                          regionCode: e.target.value,
                        }))
                      }
                      disabled={!primaryProvinceState || filteredRegions.length === 0}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-100"
                    >
                      <option value="">Select region…</option>
                      {filteredRegions.map((region) => (
                        <option key={region.code} value={region.code}>
                          {region.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newRow.plannedDays}
                      onChange={(e) =>
                        setNewRow((current) => ({
                          ...current,
                          plannedDays: e.target.value,
                        }))
                      }
                      className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => void handleAdd()}
                        disabled={
                          isAdding ||
                          !newRow.productionPhaseId ||
                          !newRow.regionCode ||
                          !newRow.plannedDays
                        }
                      >
                        {isAdding ? 'Adding…' : 'Add row'}
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
