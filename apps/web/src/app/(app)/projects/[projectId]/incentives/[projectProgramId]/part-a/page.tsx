'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@storyos/ui';
import { useProject } from '@/hooks/use-project';

export default function PartAPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';
  const { project, isLoading, error } = useProject(projectId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Part A: Plan Context</CardTitle>
          <CardDescription>
            Incentive programs evaluate the planned structure, budget, and locations of your project.
            Review and update these details in the Plan section before submitting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/projects/${projectId}/plan/project-setup`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Project Setup →
            </Link>
            <Link
              href={`/projects/${projectId}/plan/financials`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Financials →
            </Link>
            <Link
              href={`/projects/${projectId}/plan/activity-locations`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Activity & Locations →
            </Link>
            <Link
              href={`/projects/${projectId}/plan/ownership-rights`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Ownership & Rights →
            </Link>
            <Link
              href={`/projects/${projectId}/plan/compliance`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Compliance →
            </Link>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading project details...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : project ? (
        <Card>
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.title}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Format</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.format?.formatType || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Stage</dt>
                <dd className="mt-1 text-sm text-gray-900">{project.stage || 'Not set'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
