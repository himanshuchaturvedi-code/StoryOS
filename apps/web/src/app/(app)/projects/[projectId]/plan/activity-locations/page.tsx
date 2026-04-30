'use client';

import { useParams } from 'next/navigation';
import { LocationsSection } from '@/components/project/sections/activity-locations/locations-section';
import { ActivityPlanSection } from '@/components/project/sections/activity-locations/activity-plan-section';

export default function PlanActivityLocationsPage() {
  const params = useParams();
  const projectId = (params?.projectId as string) ?? '';

  return (
    <div className="space-y-10">
      <LocationsSection projectId={projectId} />
      <ActivityPlanSection projectId={projectId} />
    </div>
  );
}
