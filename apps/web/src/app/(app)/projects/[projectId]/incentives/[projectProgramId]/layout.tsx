'use client';

import { useParams } from 'next/navigation';
import { IncentiveSubtabs } from '@/components/project/shell/incentive-subtabs';

export default function IncentiveLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';
  const projectProgramId = (params?.projectProgramId as string) ?? '';

  return (
    <div className="space-y-6">
      <IncentiveSubtabs projectId={projectId} projectProgramId={projectProgramId} />
      {children}
    </div>
  );
}
