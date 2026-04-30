'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProject } from '@/hooks/use-project';
import { Button, Card, CardContent, CardHeader } from '@storyos/ui';

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { project, isLoading, error } = useProject(projectId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerateCptc = async () => {
    console.log('Generating CPTC Part A for projectId:', projectId);

    if (!projectId) {
      setGenerateError('Project ID is missing');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    try {
      // Mirror apiClient's auth pattern exactly:
      // - base URL: NEXT_PUBLIC_API_URL (defaults to http://localhost:3001)
      // - Authorization: Bearer <storyos_token> from localStorage
      // - X-Organization-Id: <storyos_org_id> from localStorage
      // Cannot use apiClient.post() directly because that parses JSON; this endpoint returns a PDF blob.
      const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
      const token = localStorage.getItem('storyos_token');
      const orgId = localStorage.getItem('storyos_org_id');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (orgId) headers['X-Organization-Id'] = orgId;

      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/documents/generate/CPTC_PART_A`,
        {
          method: 'POST',
          headers,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message || `Generation failed with status ${response.status}`,
        );
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'CPTC_Part_A.pdf';
      if (contentDisposition?.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1]!.replace(/"/g, '');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading project…</p>;
  }

  if (error || !project) {
    return (
      <div>
        <p className="text-sm text-red-600">{error ?? 'Project not found'}</p>
        <Link href="/projects">
          <Button variant="outline" className="mt-4">
            Back to projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{project.title}</h1>
          <div className="mt-2 flex gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {project.status}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {project.stage}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleGenerateCptc}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate CPTC Part A'}
          </Button>
          <Link href={`/projects/${projectId}/plan/project-setup#metadata`}>
            <Button variant="outline">Edit metadata</Button>
          </Link>
        </div>
      </div>

      {generateError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{generateError}</p>
        </div>
      )}

      {project.metadata?.logline && (
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">Logline</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{project.metadata.logline}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {project.phases && project.phases.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Production phases</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                {project.phases.map((p) => (
                  <li key={p.id}>
                    {p.name ?? p.phaseType}
                    {p.startDate && (
                      <span className="ml-2 text-gray-400">
                        {new Date(p.startDate).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Link href={`/projects/${projectId}/phases`} className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                Manage phases →
              </Link>
            </CardContent>
          </Card>
        )}

        {project.milestones && project.milestones.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-medium text-gray-900">Milestones</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                {project.milestones.map((m) => (
                  <li key={m.id}>
                    {m.name}
                    {m.dueDate && (
                      <span className="ml-2 text-gray-400">
                        Due {new Date(m.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Link href={`/projects/${projectId}/milestones`} className="mt-2 inline-block text-sm text-brand-600 hover:underline">
                Manage milestones →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
