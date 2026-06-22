'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { ProgramDocumentChecklistPanel } from '@/components/project/sections/program-document-checklist-panel';
import { ProgramApplicationStatus } from '@storyos/types';
import { Button, Input } from '@storyos/ui';

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

  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editTargetDate, setEditTargetDate] = useState<string>('');
  const [editExternalRef, setEditExternalRef] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await apiClient.get<ApplicationDetail>(
          `/projects/${projectId}/applications/${applicationId}`
        );
        if (isMounted) {
          setApplication(data);
          setEditStatus(data.status);
          setEditTargetDate(data.targetFilingDate ? (data.targetFilingDate.split('T')[0] ?? '') : '');
          setEditExternalRef(data.externalRef || '');
        }
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

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiClient.patch<ApplicationDetail>(
        `/projects/${projectId}/applications/${applicationId}`,
        {
          status: editStatus,
          targetFilingDate: editTargetDate ? new Date(editTargetDate).toISOString() : null,
          externalRef: editExternalRef || null,
        }
      );
      setApplication(updated);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update application');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (application) {
      setEditStatus(application.status);
      setEditTargetDate(application.targetFilingDate ? (application.targetFilingDate.split('T')[0] ?? '') : '');
      setEditExternalRef(application.externalRef || '');
    }
    setIsEditing(false);
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div>
        <Link
          href={`/projects/${projectId}/applications`}
          className="text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          ← Back to Applications
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{programName}</h2>
          <p className="text-sm text-gray-500">{programCode} Application Workspace</p>
        </div>
        
        {!isEditing ? (
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="block text-xs text-gray-500 uppercase tracking-wide">Status</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1
                ${application.status === ProgramApplicationStatus.PREPARING ? 'bg-amber-100 text-amber-800' : 
                  application.status === ProgramApplicationStatus.APPROVED ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'}`}>
                {application.status}
              </span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 uppercase tracking-wide">Agency Ref</span>
              <span className="block font-medium text-gray-900 mt-1">{application.externalRef || '—'}</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500 uppercase tracking-wide">Deadline</span>
              <span className="block font-medium text-gray-900 mt-1">
                {application.targetFilingDate ? new Date(application.targetFilingDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Edit Info
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-4 rounded-md bg-gray-50 p-4 w-full md:w-auto">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
              >
                {Object.values(ProgramApplicationStatus).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Agency Ref #</label>
              <input
                type="text"
                value={editExternalRef}
                onChange={(e) => setEditExternalRef(e.target.value)}
                placeholder="e.g. 123456"
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Deadline</label>
              <input
                type="date"
                value={editTargetDate}
                onChange={(e) => setEditTargetDate(e.target.value)}
                className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm"
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="pt-4">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Application Documents</h3>
        <ProgramDocumentChecklistPanel
          projectId={projectId}
          programs={[{ programCode, programName }]}
          enableCptcGeneration={programCode === 'CPTC'}
        />
      </div>
    </div>
  );
}
