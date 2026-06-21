'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ProgramDocumentChecklistPanel } from '@/components/project/sections/program-document-checklist-panel';

interface ApplicationDetail {
  id: string;
  projectProgramId: string;
  status: string;
  targetFilingDate: string | null;
  externalRef: string | null;
  notes: string | null;
  projectProgram: {
    programVersion: {
      program: {
        code: string;
        name: string;
      };
    };
  };
}

export default function FundingApplicationDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; applicationId: string }>;
}) {
  const { projectId, applicationId } = React.use(params);
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await apiClient.get<ApplicationDetail>(
          `/projects/${projectId}/applications/${applicationId}`
        );
        if (isMounted) setApplication(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load application details');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [projectId, applicationId]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Loading application details...
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error || 'Application not found'}
        </div>
        <div className="mt-4">
          <Link
            href={`/projects/${projectId}/applications`}
            className="text-sm font-medium text-brand-600 hover:text-brand-900"
          >
            ← Back to Applications
          </Link>
        </div>
      </div>
    );
  }

  const programName = application.projectProgram.programVersion.program.name;
  const programCode = application.projectProgram.programVersion.program.code;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href={`/projects/${projectId}/applications`}
          className="text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          ← Back to Applications
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            {programName}
          </h2>
          <p className="text-sm text-gray-500">{programCode}</p>
        </div>
        <div>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            {application.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Application Details
          </h3>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <dt className="font-medium text-gray-500">Target Date</dt>
              <dd className="col-span-2 text-gray-900">
                {application.targetFilingDate
                  ? new Date(application.targetFilingDate).toLocaleDateString()
                  : 'Not set'}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="font-medium text-gray-500">Ref #</dt>
              <dd className="col-span-2 text-gray-900">
                {application.externalRef || 'Not assigned'}
              </dd>
            </div>
            {application.notes && (
              <div className="grid grid-cols-3 gap-4">
                <dt className="font-medium text-gray-500">Notes</dt>
                <dd className="col-span-2 text-gray-900">{application.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="pt-4">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Application Documents</h3>
        <ProgramDocumentChecklistPanel
          projectId={projectId}
          programs={[{ programCode, programName }]}
        />
      </div>
    </div>
  );
}
