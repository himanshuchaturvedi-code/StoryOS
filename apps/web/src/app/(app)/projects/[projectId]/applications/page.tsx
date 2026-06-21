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

export default function FundingApplicationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = React.use(params);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await apiClient.get<ApplicationSummary[]>(`/projects/${projectId}/applications`);
        if (isMounted) setApplications(data);
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
                <th className="px-4 py-3 font-medium text-gray-500">Target Date</th>
                <th className="px-4 py-3 font-medium text-gray-500">Ref #</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {app.projectProgram.programVersion.program.name} ({app.projectProgram.programVersion.program.code})
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      {app.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {app.targetFilingDate ? new Date(app.targetFilingDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                    {app.externalRef || '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                    <Link
                      href={`/projects/${projectId}/applications/${app.id}`}
                      className="text-brand-600 hover:text-brand-900"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
