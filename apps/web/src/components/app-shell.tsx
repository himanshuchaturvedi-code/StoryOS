'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TenantProvider, useTenant } from '@/contexts/tenant-context';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { orgs, currentOrgId, setCurrentOrgId, isLoading } = useTenant();

  function handleLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('storyos_token');
      localStorage.removeItem('storyos_org_id');
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Link href="/" className="text-lg font-bold text-gray-900 hover:text-brand-600">
            StoryOS
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Projects
          </Link>
          <Link
            href="/persons"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Persons
          </Link>
          <Link
            href="/locations"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Locations
          </Link>
          <div className="my-2 border-t border-gray-100" />
          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Settings
          </p>
          <Link
            href="/settings"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Organization
          </Link>
          <Link
            href="/settings/budget-templates"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Budget Templates
          </Link>
          <Link
            href="/settings/vendors"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Vendor Library
          </Link>
          <Link
            href="/settings/programs"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Programs
          </Link>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <span className="text-sm text-gray-500">StoryOS</span>
          <div className="flex items-center gap-3">
          {!isLoading && orgs.length > 0 && (
            <select
              value={currentOrgId ?? ''}
              onChange={(e) => setCurrentOrgId(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <AppShellInner>{children}</AppShellInner>
    </TenantProvider>
  );
}
