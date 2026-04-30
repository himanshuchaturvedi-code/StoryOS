'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useProject } from '@/hooks/use-project';
import { Button, Card, CardContent, CardHeader } from '@storyos/ui';
import { Stage } from '@storyos/types';

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: Stage.DEVELOPMENT, label: 'Development' },
  { value: Stage.PRE_PRODUCTION, label: 'Pre-production' },
  { value: Stage.PRODUCTION, label: 'Production' },
  { value: Stage.POST_PRODUCTION, label: 'Post-production' },
  { value: Stage.COMPLETED, label: 'Completed' },
];

export default function ProjectStagesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;
  const { project, isLoading, refetch } = useProject(projectId);
  const [stage, setStage] = useState<Stage>(Stage.DEVELOPMENT);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<Array<{ stage: string; enteredAt: string; changedBy?: { firstName: string; lastName: string } }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setStage((project.stage as Stage) ?? Stage.DEVELOPMENT);
    }
  }, [project]);

  useEffect(() => {
    if (!projectId) return;
    apiClient
      .get<typeof history>(`/projects/${projectId}/stages`)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/projects/${projectId}/stages`, { stage, notes });
      await refetch();
      const h = await apiClient.get<typeof history>(`/projects/${projectId}/stages`);
      setHistory(h ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update stage');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Update production stage</h2>
          <p className="text-sm text-gray-500">Current stage: {project?.stage ?? '—'}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update stage'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Stage history</h2>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No stage changes recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between">
                  <span>{h.stage}</span>
                  <span className="text-gray-500">
                    {new Date(h.enteredAt).toLocaleString()}
                    {h.changedBy && ` by ${h.changedBy.firstName} ${h.changedBy.lastName}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
