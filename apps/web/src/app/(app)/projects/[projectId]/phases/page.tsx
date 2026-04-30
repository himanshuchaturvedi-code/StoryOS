'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useProject } from '@/hooks/use-project';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { PhaseType } from '@storyos/types';

const PHASE_OPTIONS: { value: PhaseType; label: string }[] = [
  { value: PhaseType.DEVELOPMENT, label: 'Development' },
  { value: PhaseType.PRE_PRODUCTION, label: 'Pre-production' },
  { value: PhaseType.PRINCIPAL_PHOTOGRAPHY, label: 'Principal photography' },
  { value: PhaseType.POST_PRODUCTION, label: 'Post-production' },
  { value: PhaseType.VFX, label: 'VFX' },
  { value: PhaseType.ANIMATION, label: 'Animation' },
  { value: PhaseType.SOUND_MIX, label: 'Sound mix' },
  { value: PhaseType.COLOR_GRADE, label: 'Color grade' },
  { value: PhaseType.MUSIC, label: 'Music' },
  { value: PhaseType.OTHER, label: 'Other' },
];

export default function ProjectPhasesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const { project, isLoading, refetch } = useProject(projectId);
  const [phases, setPhases] = useState<Array<{ id: string; phaseType: string; name?: string; startDate?: string; endDate?: string }>>([]);
  const [phaseType, setPhaseType] = useState<PhaseType>(PhaseType.PRINCIPAL_PHOTOGRAPHY);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPhases(project?.phases ?? []);
  }, [project]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/projects/${projectId}/phases`, {
        phaseType,
        name: name || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      await refetch();
      setName('');
      setStartDate('');
      setEndDate('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add phase');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(phaseId: string) {
    try {
      await apiClient.delete(`/projects/${projectId}/phases/${phaseId}`);
      await refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove phase');
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Add production phase</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phase type</label>
              <select
                value={phaseType}
                onChange={(e) => setPhaseType(e.target.value as PhaseType)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {PHASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add phase'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Production phases</h2>
        </CardHeader>
        <CardContent>
          {phases.length === 0 ? (
            <p className="text-sm text-gray-500">No phases added yet.</p>
          ) : (
            <ul className="space-y-3">
              {phases.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
                >
                  <div>
                    <span className="font-medium">{p.name ?? p.phaseType}</span>
                    {p.startDate && (
                      <span className="ml-2 text-sm text-gray-500">
                        {new Date(p.startDate).toLocaleDateString()}
                        {p.endDate && ` – ${new Date(p.endDate).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
