'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useProject } from '@/hooks/use-project';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';

interface ProjectSectionProps {
  projectId: string;
}

export function MetadataSection({ projectId }: ProjectSectionProps) {
  const router = useRouter();
  const { project, isLoading, refetch } = useProject(projectId);
  const [logline, setLogline] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [productionYear, setProductionYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project?.metadata) {
      setLogline(project.metadata.logline ?? '');
      setSynopsis(project.metadata.synopsis ?? '');
      setGenre(project.metadata.genre ?? '');
      setProductionYear(project.metadata.productionYear?.toString() ?? '');
    }
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/projects/${projectId}/metadata`, {
        logline: logline || undefined,
        synopsis: synopsis || undefined,
        genre: genre || undefined,
        productionYear: productionYear ? parseInt(productionYear, 10) : undefined,
      });
      await refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <Card>
      <CardHeader>
        <h2 className="font-medium text-gray-900">Project metadata</h2>
        <p className="text-sm text-gray-500">Core creative and descriptive information</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Logline"
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
            placeholder="One-sentence summary"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Synopsis</label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Brief synopsis"
            />
          </div>
          <Input
            label="Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="e.g. Drama, Comedy"
          />
          <Input
            label="Production year"
            type="number"
            value={productionYear}
            onChange={(e) => setProductionYear(e.target.value)}
            placeholder="e.g. 2025"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save metadata'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
