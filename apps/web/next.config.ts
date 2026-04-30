import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@storyos/ui'],
  experimental: {
    // Enable when needed: optimizePackageImports: ['@storyos/ui'],
  },
  async redirects() {
    return [
      // Absorbed Phase 1 legacy routes mapping to the new UI structure
      { source: '/projects/:id/metadata', destination: '/projects/:id/plan/project-setup#metadata', permanent: true },
      { source: '/projects/:id/format', destination: '/projects/:id/plan/project-setup#format', permanent: true },
      { source: '/projects/:id/participants', destination: '/projects/:id/plan/project-setup#participants', permanent: true },
      { source: '/projects/:id/budget', destination: '/projects/:id/plan/financials#budget', permanent: true },
      { source: '/projects/:id/finance', destination: '/projects/:id/plan/financials#finance', permanent: true },
      { source: '/projects/:id/locations', destination: '/projects/:id/plan/activity-locations#locations', permanent: true },
      { source: '/projects/:id/activity-plan', destination: '/projects/:id/plan/activity-locations#activity-plan', permanent: true },
      { source: '/projects/:id/ownership', destination: '/projects/:id/plan/ownership-rights#ownership', permanent: true },
      { source: '/projects/:id/rights-control', destination: '/projects/:id/plan/ownership-rights#rights', permanent: true },
      { source: '/projects/:id/residency', destination: '/projects/:id/plan/compliance#residency', permanent: true },
      { source: '/projects/:id/activity-days', destination: '/projects/:id/actuals/activity-locations#activity-days', permanent: true },
      { source: '/projects/:id/expense-facts', destination: '/projects/:id/actuals/financials#expense-facts', permanent: true },
      { source: '/projects/:id/programs', destination: '/projects/:id/incentives', permanent: true },
    ];
  },
};

export default nextConfig;
