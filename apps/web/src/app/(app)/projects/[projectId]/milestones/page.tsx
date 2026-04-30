'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useProject } from '@/hooks/use-project';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';

export default function ProjectMilestonesPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { project, isLoading, refetch } = useProject(projectId);
  const [milestones, setMilestones] = useState<Array<{ id: string; name: string; dueDate?: string; actualDate?: string }>>([]);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMilestones(project?.milestones ?? []);
  }, [project]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(`/projects/${projectId}/milestones`, {
        name,
        dueDate: dueDate || undefined,
      });
      await refetch();
      setName('');
      setDueDate('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add milestone');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(milestoneId: string) {
    try {
      await apiClient.delete(`/projects/${projectId}/milestones/${milestoneId}`);
      await refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove milestone');
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Add milestone</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Principal photography start"
              required
            />
            <Input
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Adding…' : 'Add milestone'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Milestones</h2>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-500">No milestones added yet.</p>
          ) : (
            <ul className="space-y-3">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
                >
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.dueDate && (
                      <span className="ml-2 text-sm text-gray-500">
                        Due {new Date(m.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)}>
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
