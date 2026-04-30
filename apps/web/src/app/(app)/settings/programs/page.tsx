'use client';

import { useState } from 'react';
import { usePrograms, type Program, type ProgramVersion } from '@/hooks/use-programs';

type VersionSummary = {
  id: string;
  versionCode: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};
import { apiClient } from '@/lib/api-client';

const SCOPE_LABELS: Record<string, string> = {
  FEDERAL: 'Federal',
  PROVINCIAL: 'Provincial',
  MUNICIPAL: 'Municipal',
  PRIVATE_FUND: 'Private Fund',
  INTERNATIONAL: 'International',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-CA');
}

function ProgramVersionRow({
  v,
  onSelectVersion,
}: {
  v: VersionSummary;
  onSelectVersion: (versionId: string) => void;
}) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-2 text-sm font-mono text-gray-700">{v.versionCode}</td>
      <td className="px-3 py-2 text-sm text-gray-800">{v.name}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(v.effectiveFrom)}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(v.effectiveTo) || 'Current'}</td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => onSelectVersion(v.id)}
          className="text-xs text-brand-600 hover:text-brand-700"
        >
          View requirements
        </button>
      </td>
    </tr>
  );
}

function ProgramCard({
  program,
  onSelectVersion,
}: {
  program: Program;
  onSelectVersion: (versionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-gray-50/40"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{program.name}</span>
          <span className="font-mono text-xs text-gray-500">{program.code}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {SCOPE_LABELS[program.scope] ?? program.scope}
          </span>
          {!program.isActive && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">
              Inactive
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {program.versions?.length ?? 0} version{program.versions?.length !== 1 ? 's' : ''}
        </span>
      </div>
      {expanded && program.versions && program.versions.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-4">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase text-gray-500">Version</th>
                <th className="px-3 py-2 text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-3 py-2 text-xs font-medium uppercase text-gray-500">From</th>
                <th className="px-3 py-2 text-xs font-medium uppercase text-gray-500">To</th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500" />
              </tr>
            </thead>
            <tbody>
              {program.versions.map((v) => (
                <ProgramVersionRow
                  key={v.id}
                  v={v}
                  onSelectVersion={onSelectVersion}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProgramsPage() {
  const { programs, isLoading, error } = usePrograms(undefined, true);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionDetail, setVersionDetail] = useState<ProgramVersion | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);

  const loadVersion = async (versionId: string) => {
    setSelectedVersionId(versionId);
    setLoadingVersion(true);
    try {
      const program = programs.find((p) =>
        p.versions?.some((v) => v.id === versionId),
      );
      if (program) {
        const detail = await apiClient.get<ProgramVersion>(
          `/programs/${program.id}/versions/${versionId}`,
        );
        setVersionDetail(detail ?? null);
      }
    } catch {
      setVersionDetail(null);
    } finally {
      setLoadingVersion(false);
    }
  };

  if (isLoading) return <p className="text-sm text-gray-500">Loading programs...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Programs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse available incentive programs and their requirements. Read-only.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {programs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-8 text-center text-sm text-gray-500">
              No programs found. Programs are seeded by the platform administrator.
            </p>
          ) : (
            programs.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                onSelectVersion={loadVersion}
              />
            ))
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-medium text-gray-900">Version Requirements</h3>
          {!selectedVersionId ? (
            <p className="mt-2 text-xs text-gray-500">
              Select a version to view its requirements.
            </p>
          ) : loadingVersion ? (
            <p className="mt-2 text-xs text-gray-500">Loading...</p>
          ) : versionDetail ? (
            <ul className="mt-3 space-y-2">
              {versionDetail.requirements?.map((r) => (
                <li key={r.id} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-gray-500">{r.code}</span>
                  <span className="text-gray-700">{r.name}</span>
                  {!r.isRequired && (
                    <span className="rounded bg-amber-50 px-1 text-amber-700">Optional</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-red-500">Failed to load version.</p>
          )}
        </div>
      </div>
    </div>
  );
}
