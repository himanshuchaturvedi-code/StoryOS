'use client';

import { useParams } from 'next/navigation';
import { PlanSubtabs } from '@/components/project/shell/plan-subtabs';

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <PlanSubtabs projectId={projectId} basePath="plan" />
      </div>
      {children}
    </div>
  );
}
