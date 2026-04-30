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

export default function PartBPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Part B: Actuals Readiness</CardTitle>
          <CardDescription>
            Incentive programs evaluate your realized expenses and activity logs.
            Review and update these details in the Actuals section before submitting Part B.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/projects/${projectId}/actuals/financials`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Expense Facts →
            </Link>
            <Link
              href={`/projects/${projectId}/actuals/activity-locations`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Activity Days →
            </Link>
            <Link
              href={`/projects/${projectId}/actuals/compliance`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Compliance Documents →
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracking</CardTitle>
          <CardDescription>
            Once you log expense facts and activity days, your readiness score will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No actuals summarized yet. Use the links above to start logging.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
