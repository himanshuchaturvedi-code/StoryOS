'use client';

import { useParams } from 'next/navigation';
import { IncentiveStrategySection } from '@/components/project/sections/incentive-strategy-section';

export default function PlanIncentiveStrategyPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return <IncentiveStrategySection projectId={projectId} source="BUDGET" />;
}
