'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProjectPrograms } from '@/hooks/use-programs';

interface IncentiveSubtabsProps {
  projectId: string;
  projectProgramId: string;
}

interface SubtabDef {
  slug: string;
  label: string;
}

const SUBTABS: SubtabDef[] = [
  { slug: 'part-a', label: 'Part A' },
  { slug: 'part-b', label: 'Part B' },
  { slug: 'results', label: 'Results' },
];

export function IncentiveSubtabs({ projectId, projectProgramId }: IncentiveSubtabsProps) {
  const pathname = usePathname() ?? '';
  const base = `/projects/${projectId}/incentives/${projectProgramId}`;
  const { enrollments, isLoading } = useProjectPrograms(projectId);

  const enrollment = enrollments.find((e) => e.id === projectProgramId);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/projects/${projectId}/incentives`}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          ← Back to Incentives
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">
          {isLoading ? (
            <span className="text-gray-400">Loading program...</span>
          ) : enrollment ? (
            <>
              {enrollment.programVersion.program.name}{' '}
              <span className="text-sm font-normal text-gray-500">
                ({enrollment.programVersion.versionCode})
              </span>
            </>
          ) : (
            <span className="text-gray-400">Program not found</span>
          )}
        </h2>
      </div>

      <nav aria-label="Incentive sub-sections" className="-mb-px flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-200">
        {SUBTABS.map((tab) => {
          const href = `${base}/${tab.slug}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.slug}
              href={href}
              className={`border-b-2 py-3 text-sm font-medium ${
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
