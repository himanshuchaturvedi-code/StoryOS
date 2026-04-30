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

interface ActualsCard {
  title: string;
  description: string;
  href: string;
}

export default function ActualsOverviewPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  const cards: ActualsCard[] = [
    {
      title: 'Project Setup',
      description: 'Read-only reference for title, format, and participants.',
      href: `/projects/${projectId}/actuals/project-setup`,
    },
    {
      title: 'Financials',
      description: 'Record expense facts and compare against planned financials.',
      href: `/projects/${projectId}/actuals/financials`,
    },
    {
      title: 'Activity & Locations',
      description: 'Log actual activity days against planned locations and work.',
      href: `/projects/${projectId}/actuals/activity-locations`,
    },
    {
      title: 'Ownership & Rights',
      description: 'Read-only reference for ownership and rights assertions.',
      href: `/projects/${projectId}/actuals/ownership-rights`,
    },
    {
      title: 'Compliance',
      description: 'Read-only reference for residency and project documents.',
      href: `/projects/${projectId}/actuals/compliance`,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Actuals</CardTitle>
          <CardDescription>
            Track realized activity and expenses while keeping planned project data as
            read-only context.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={card.href}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Open
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
