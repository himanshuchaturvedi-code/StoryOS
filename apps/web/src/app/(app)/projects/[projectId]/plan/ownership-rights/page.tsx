'use client';

import { useParams } from 'next/navigation';
import { OwnershipSection } from '@/components/project/sections/ownership-rights/ownership-section';
import { RightsControlSection } from '@/components/project/sections/ownership-rights/rights-control-section';

export default function PlanOwnershipRightsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <OwnershipSection projectId={projectId} />
      <RightsControlSection projectId={projectId} />
    </div>
  );
}
