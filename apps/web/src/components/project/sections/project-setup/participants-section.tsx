'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { useTenant } from '@/contexts/tenant-context';
import { usePersons } from '@/hooks/use-persons';
import { Button, Card, CardContent, CardHeader } from '@storyos/ui';

interface ParticipantRole {
  id: string;
  roleType: { id: string; code: string; name: string; category: string };
  productionPhase?: { id: string; name: string } | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface Participant {
  id: string;
  person: { id: string; firstName: string; lastName: string; email?: string | null };
  roles: ParticipantRole[];
}

interface ProjectSectionProps {
  projectId: string;
}

export function ParticipantsSection({ projectId }: ProjectSectionProps) {
  const { currentOrgId } = useTenant();
  const { persons } = usePersons(currentOrgId);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add participant form
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchParticipants = useCallback(async () => {
    try {
      const list = (await apiClient.get<Participant[]>(`/projects/${projectId}/participants`)) ?? [];
      setParticipants(list);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load participants');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPersonId) return;
    setIsAdding(true);
    try {
      await apiClient.post(`/projects/${projectId}/participants`, { personId: selectedPersonId });
      setSelectedPersonId('');
      await fetchParticipants();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add participant');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove(participantId: string) {
    try {
      await apiClient.delete(`/projects/${projectId}/participants/${participantId}`);
      await fetchParticipants();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove participant');
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  const participantPersonIds = new Set(participants.map((p) => p.person.id));
  const availablePersons = persons.filter((p) => !participantPersonIds.has(p.id));

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Add participant</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Person</label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select a person…</option>
                {availablePersons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName}
                    {p.email ? ` (${p.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={!selectedPersonId || isAdding}>
              {isAdding ? 'Adding…' : 'Add'}
            </Button>
          </form>
          {availablePersons.length === 0 && persons.length > 0 && (
            <p className="mt-2 text-sm text-gray-500">All persons are already participants.</p>
          )}
          {persons.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              No persons in your organization yet. Add persons first.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-gray-900">Participants ({participants.length})</h2>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-gray-500">No participants added yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {participants.map((p) => (
                <li key={p.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {p.person.lastName}, {p.person.firstName}
                      </p>
                      {p.person.email && (
                        <p className="text-sm text-gray-500">{p.person.email}</p>
                      )}
                      {p.roles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {p.roles.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                            >
                              {r.roleType.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id)}>
                        Remove
                      </Button>
                    </div>
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
