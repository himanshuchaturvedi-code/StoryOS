'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@/lib/api-client';
import { useProject } from '@/hooks/use-project';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { FormatType } from '@storyos/types';

const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: FormatType.FEATURE_FILM, label: 'Feature film' },
  { value: FormatType.TV_SERIES, label: 'TV series' },
  { value: FormatType.TV_MOVIE, label: 'TV movie' },
  { value: FormatType.SHORT_FILM, label: 'Short film' },
  { value: FormatType.DOCUMENTARY_FEATURE, label: 'Documentary feature' },
  { value: FormatType.DOCUMENTARY_SERIES, label: 'Documentary series' },
  { value: FormatType.WEB_SERIES, label: 'Web series' },
  { value: FormatType.ANIMATION_SERIES, label: 'Animation series' },
  { value: FormatType.ANIMATION_FEATURE, label: 'Animation feature' },
  { value: FormatType.OTHER, label: 'Other' },
];

interface ProjectSectionProps {
  projectId: string;
}

export function FormatSection({ projectId }: ProjectSectionProps) {
  const router = useRouter();
  const { project, isLoading, refetch } = useProject(projectId);
  const [formatType, setFormatType] = useState<FormatType>(FormatType.FEATURE_FILM);
  const [totalRuntimeMinutes, setTotalRuntimeMinutes] = useState('');
  const [numberOfEpisodes, setNumberOfEpisodes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project?.format) {
      setFormatType((project.format.formatType as FormatType) ?? FormatType.FEATURE_FILM);
      setTotalRuntimeMinutes(project.format.totalRuntimeMinutes?.toString() ?? '');
      setNumberOfEpisodes(project.format.numberOfEpisodes?.toString() ?? '');
    }
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/projects/${projectId}/format`, {
        formatType,
        totalRuntimeMinutes: totalRuntimeMinutes ? parseInt(totalRuntimeMinutes, 10) : undefined,
        numberOfEpisodes: numberOfEpisodes ? parseInt(numberOfEpisodes, 10) : undefined,
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
        <h2 className="font-medium text-gray-900">Project format</h2>
        <p className="text-sm text-gray-500">Structural and technical specifications</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Format type</label>
            <select
              value={formatType}
              onChange={(e) => setFormatType(e.target.value as FormatType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Total runtime (minutes)"
            type="number"
            value={totalRuntimeMinutes}
            onChange={(e) => setTotalRuntimeMinutes(e.target.value)}
            placeholder="e.g. 90"
          />
          <Input
            label="Number of episodes"
            type="number"
            value={numberOfEpisodes}
            onChange={(e) => setNumberOfEpisodes(e.target.value)}
            placeholder="e.g. 8"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save format'}
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
