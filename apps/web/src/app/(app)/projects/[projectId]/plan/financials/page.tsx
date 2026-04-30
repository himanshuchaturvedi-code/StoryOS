'use client';

import { useParams } from 'next/navigation';
import { BudgetSection } from '@/components/project/sections/financials/budget-section';
import { FinanceSection } from '@/components/project/sections/financials/finance-section';

export default function PlanFinancialsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <BudgetSection projectId={projectId} />
      <FinanceSection projectId={projectId} />
    </div>
  );
}
