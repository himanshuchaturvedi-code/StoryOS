'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PlanBasePath = 'plan' | 'actuals';

interface PlanSubtabsProps {
  projectId: string;
  basePath?: PlanBasePath;
}

interface SubtabDef {
  slug: string;
  label: string;
}

const SUBTABS: SubtabDef[] = [
  { slug: 'overview', label: 'Overview' },
  { slug: 'project-setup', label: 'Project Setup' },
  { slug: 'financials', label: 'Financials' },
  { slug: 'incentive-strategy', label: 'Incentive Strategy' },
  { slug: 'activity-locations', label: 'Activity & Locations' },
  { slug: 'ownership-rights', label: 'Ownership & Rights' },
  { slug: 'compliance', label: 'Compliance' },
];

export function PlanSubtabs({ projectId, basePath = 'plan' }: PlanSubtabsProps) {
  const pathname = usePathname() ?? '';
  const base = `/projects/${projectId}/${basePath}`;

  return (
    <nav aria-label={`${basePath} sub-sections`} className="-mb-px flex flex-wrap gap-x-6 gap-y-2">
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
  );
}
