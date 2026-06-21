'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface ApplicationSummary {
  id: string;
  projectProgramId: string;
  status: string;
  targetFilingDate: string | null;
  externalRef: string | null;
  projectProgram: {
    programVersion: {
      program: {
        code: string;
        name: string;
      };
    };
  };
}

interface ChecklistSummary {
  requiredCount: number;
  fulfilledRequiredCount: number;
  missingRequiredCount: number;
}

export default function FundingApplicationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = React.use(params);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [checklists, setChecklists] = useState<Record<string, ChecklistSummary | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const apps = await apiClient.get<ApplicationSummary[]>(`/projects/${projectId}/applications`);
        if (!isMounted) return;
        setApplications(apps || []);

        if (apps && apps.length > 0) {
          const checklistEntries = await Promise.all(
            apps.map(async (app) => {
              const code = app.projectProgram.programVersion.program.code;
              try {
                const checklist = await apiClient.get<ChecklistSummary>(
                  `/projects/${projectId}/programs/by-code/${code}/document-checklist`,
                );
                return [app.id, checklist] as const;
              } catch {
                return [app.id, null] as const;
              }
            }),
          );
          if (isMounted) {
            setChecklists(Object.fromEntries(checklistEntries));
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load applications');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Loading funding applications...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-md border border-brand-200 bg-brand-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-brand-600">ℹ️</span>
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-brand-700">
              Welcome to the new Funding Applications tab. You can now manage your active applications here.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Active Applications</h2>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No funding applications found. Initiate an application from the Incentive Strategy tab.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-500">Program</th>
                <th className="px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 font-medium text-gray-500">Progress</th>
                <th className="px-4 py-3 font-medium text-gray-500">Next Deadline</th>
                <th className="px-4 py-3 font-medium text-gray-500">Agency Ref #</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {applications.map((app) => {
                const checklist = checklists[app.id];
                const progressPercent = checklist && checklist.requiredCount > 0
                  ? Math.round((checklist.fulfilledRequiredCount / checklist.requiredCount) * 100)
                  : 0;

                return (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="font-medium text-gray-900">
                        {app.projectProgram.programVersion.program.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {app.projectProgram.programVersion.program.code}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                        ${app.status === 'PREPARING' ? 'bg-amber-100 text-amber-800' : 
                          app.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {checklist ? (
                        <div className="flex flex-col gap-1 w-32">
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>{checklist.fulfilledRequiredCount} / {checklist.requiredCount}</span>
                            {checklist.missingRequiredCount > 0 && (
                              <span className="font-medium text-red-600">{checklist.missingRequiredCount} missing</span>
                            )}
                          </div>
                          {checklist.requiredCount > 0 && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className={`h-full rounded-full transition-all ${checklist.missingRequiredCount === 0 ? 'bg-green-500' : 'bg-brand-500'}`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No checklist</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {app.targetFilingDate ? (
                        <span className="font-medium">
                          {new Date(app.targetFilingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700">
                      {app.externalRef || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium">
                      <Link
                        href={`/projects/${projectId}/applications/${app.id}`}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
