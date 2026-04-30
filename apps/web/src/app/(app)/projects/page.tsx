'use client';

import Link from 'next/link';
import { useTenant } from '@/contexts/tenant-context';
import { useProjects } from '@/hooks/use-projects';
import { Button, Card, CardContent, CardHeader } from '@storyos/ui';

export default function ProjectsPage() {
  const { currentOrgId } = useTenant();
  const { projects, isLoading, error, refetch } = useProjects(currentOrgId);

  if (!currentOrgId) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500">Select an organization to view projects.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Projects</h1>
        <p className="text-sm text-gray-500">Loading projects…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Projects</h1>
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
        <Link href="/projects/new">
          <Button>New project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-sm text-gray-500">No projects yet.</p>
            <Link href="/projects/new">
              <Button>Create your first project</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <h2 className="font-medium text-gray-900">{project.title}</h2>
                  <div className="flex gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {project.status}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {project.stage}
                    </span>
                  </div>
                </CardHeader>
                {project.metadata?.logline && (
                  <CardContent className="pt-0">
                    <p className="line-clamp-2 text-sm text-gray-500">
                      {project.metadata.logline}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
