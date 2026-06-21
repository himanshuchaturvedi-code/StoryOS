'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ProjectTabsProps {
  projectId: string;
}

interface TabDef {
  key: 'home' | 'plan' | 'incentives' | 'applications' | 'documents' | 'actuals';
  label: string;
  href: string;
  enabled: boolean;
  match: (pathname: string, base: string) => boolean;
}

const TABS: TabDef[] = [
  {
    key: 'home',
    label: 'Home',
    href: '',
    enabled: true,
    match: (pathname, base) => pathname === base,
  },
  {
    key: 'plan',
    label: 'Project Data',
    href: '/plan',
    enabled: true,
    match: (pathname, base) =>
      pathname === `${base}/plan` || pathname.startsWith(`${base}/plan/`),
  },
  {
    key: 'incentives',
    label: 'Strategy & Applications',
    href: '/incentives',
    enabled: true,
    match: (pathname, base) =>
      pathname === `${base}/incentives` || pathname.startsWith(`${base}/incentives/`),
  },
  {
    key: 'applications',
    label: 'Funding Applications',
    href: '/applications',
    enabled: true,
    match: (pathname, base) =>
      pathname === `${base}/applications` || pathname.startsWith(`${base}/applications/`),
  },
  {
    key: 'documents',
    label: 'Document Vault',
    href: '/documents',
    enabled: true,
    match: (pathname, base) =>
      pathname === `${base}/documents` || pathname.startsWith(`${base}/documents/`),
  },
  {
    key: 'actuals',
    label: 'Compliance & Claims',
    href: '/actuals',
    enabled: true,
    match: (pathname, base) =>
      pathname === `${base}/actuals` || pathname.startsWith(`${base}/actuals/`),
  },
];

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname() ?? '';
  const base = `/projects/${projectId}`;

  return (
    <nav aria-label="Project sections" className="-mb-px flex gap-6">
      {TABS.map((tab) => {
        const isActive = tab.match(pathname, base);
        const baseClass = 'border-b-2 py-4 text-sm font-medium';
        const activeClass = 'border-brand-600 text-brand-600';
        const inactiveClass =
          'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700';

        if (!tab.enabled) {
          return (
            <span
              key={tab.key}
              aria-disabled="true"
              className={`${baseClass} cursor-not-allowed border-transparent text-gray-300`}
              title="Coming soon"
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Soon
              </span>
            </span>
          );
        }

        return (
          <Link
            key={tab.key}
            href={`${base}${tab.href}`}
            className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
