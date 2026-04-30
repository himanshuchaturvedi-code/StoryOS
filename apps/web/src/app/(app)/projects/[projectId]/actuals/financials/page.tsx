'use client';

import { useParams } from 'next/navigation';
import { ExpenseFactsSection } from '@/components/project/sections/financials/expense-facts-section';
import { ActualsReferenceCard } from '@/components/project/shell/actuals-reference-card';

export default function ActualsFinancialsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <ActualsReferenceCard
        title="Planned Financials"
        description="Budgets and finance plans stay in Plan. Use them here as reference while recording realized expense facts."
        links={[
          { href: `/projects/${projectId}/plan/financials`, label: 'Open Plan Financials' },
          { href: `/projects/${projectId}/plan/financials#budget`, label: 'Open Budget' },
          { href: `/projects/${projectId}/plan/financials#finance`, label: 'Open Finance Plan' },
          { href: `/projects/${projectId}/estimates`, label: 'Open Estimates' },
        ]}
      />

      <ExpenseFactsSection projectId={projectId} />
    </div>
  );
}
