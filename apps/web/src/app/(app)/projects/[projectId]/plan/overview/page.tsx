'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@storyos/ui';
import { useProject } from '@/hooks/use-project';
import { GrantEstimateCard } from '@/components/project/cards/grant-estimate-card';

interface PlanCard {
  title: string;
  description: string;
  href: string;
  extras?: Array<{ label: string; href: string }>;
}

export default function PlanOverviewPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';
  const { project, isLoading, error } = useProject(projectId);

  const cards: PlanCard[] = [
    {
      title: 'Project Setup',
      description: 'Title, format, languages, and participants.',
      href: `/projects/${projectId}/plan/project-setup`,
    },
    {
      title: 'Financials',
      description: 'Budget categories, lines, and finance plan.',
      href: `/projects/${projectId}/plan/financials`,
    },
    {
      title: 'Activity & Locations',
      description: 'Linked locations and planned activity by location.',
      href: `/projects/${projectId}/plan/activity-locations`,
    },
    {
      title: 'Ownership & Rights',
      description: 'Ownership chain and rights / control assertions.',
      href: `/projects/${projectId}/plan/ownership-rights`,
    },
    {
      title: 'Compliance',
      description: 'Residency records and supporting documents.',
      href: `/projects/${projectId}/plan/compliance`,
    },
    {
      title: 'Schedule',
      description: 'Stages, phases, and milestones (legacy).',
      href: `/projects/${projectId}/stages`,
      extras: [
        { label: 'Phases', href: `/projects/${projectId}/phases` },
        { label: 'Milestones', href: `/projects/${projectId}/milestones` },
      ],
    },
    {
      title: 'Documents',
      description: 'Project document library (chain of title, contracts, etc.).',
      href: `/projects/${projectId}/documents`,
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading project…</p>
      ) : (
        project?.metadata?.logline && (
          <Card>
            <CardHeader>
              <CardTitle>Logline</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{project.metadata.logline}</p>
            </CardContent>
          </Card>
        )
      )}

      <GrantEstimateCard projectId={projectId} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link
                href={card.href}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Open →
              </Link>
              {card.extras && (
                <div className="flex gap-3 text-xs text-gray-500">
                  {card.extras.map((extra) => (
                    <Link
                      key={extra.href}
                      href={extra.href}
                      className="hover:text-brand-600"
                    >
                      {extra.label} →
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
