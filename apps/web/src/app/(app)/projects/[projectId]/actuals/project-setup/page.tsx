'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@storyos/ui';
import { useProject } from '@/hooks/use-project';

function DisplayValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || 'Not set'}</dd>
    </div>
  );
}

export default function ActualsProjectSetupPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';
  const { project, isLoading, error } = useProject(projectId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Setup Reference</CardTitle>
          <CardDescription>
            Actuals use project setup as read-only context. Edit these values in Plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading project...</p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DisplayValue label="Title" value={project?.title} />
              <DisplayValue label="Status" value={project?.status} />
              <DisplayValue label="Stage" value={project?.stage} />
              <DisplayValue label="Genre" value={project?.metadata?.genre} />
              <DisplayValue
                label="Production Year"
                value={project?.metadata?.productionYear}
              />
              <DisplayValue label="Format" value={project?.format?.formatType} />
              <DisplayValue
                label="Runtime"
                value={
                  project?.format?.totalRuntimeMinutes
                    ? `${project.format.totalRuntimeMinutes} minutes`
                    : null
                }
              />
              <DisplayValue
                label="Episodes"
                value={project?.format?.numberOfEpisodes}
              />
            </dl>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/projects/${projectId}/plan/project-setup`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Open Plan Project Setup
            </Link>
            <Link
              href={`/projects/${projectId}/plan/project-setup#participants`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Open Participants
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
